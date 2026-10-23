//! Studio compute core. The host owns authorization, UI and database writes.
//! Every ABI call is synchronous inside its owning Worker or browser turn.
use flate2::{Decompress, FlushDecompress, Status};
use serde_json::{Map, Value};
use std::{
    alloc::{alloc_zeroed, dealloc, Layout},
    cell::RefCell,
};
use std::{
    cmp::{Ordering, Reverse},
    collections::{BinaryHeap, HashSet},
    slice,
};
struct State {
    output: Vec<u8>,
    files: Vec<(String, String)>,
}
thread_local! { static STATE: RefCell<State> = const { RefCell::new(State { output: Vec::new(), files: Vec::new() }) }; }
#[no_mangle]
pub unsafe extern "C" fn alloc(size: usize) -> *mut u8 {
    let ptr = alloc_zeroed(Layout::from_size_align(size.max(1), 8).unwrap());
    if ptr.is_null() {
        std::process::abort();
    }
    ptr
}
#[no_mangle]
pub unsafe extern "C" fn release(ptr: *mut u8, size: usize) {
    dealloc(ptr, Layout::from_size_align(size.max(1), 8).unwrap());
}
#[no_mangle]
pub extern "C" fn output_ptr() -> *const u8 {
    STATE.with(|s| s.borrow().output.as_ptr())
}
#[no_mangle]
pub extern "C" fn output_len() -> usize {
    STATE.with(|s| s.borrow().output.len())
}
#[no_mangle]
pub extern "C" fn reset_files() {
    STATE.with(|s| s.borrow_mut().files.clear());
}
#[no_mangle]
pub extern "C" fn file_count() -> usize {
    STATE.with(|s| s.borrow().files.len())
}
#[no_mangle]
pub extern "C" fn file_name_ptr(i: usize) -> *const u8 {
    STATE.with(|s| s.borrow().files[i].0.as_ptr())
}
#[no_mangle]
pub extern "C" fn file_name_len(i: usize) -> usize {
    STATE.with(|s| s.borrow().files[i].0.len())
}
#[no_mangle]
pub extern "C" fn file_text_ptr(i: usize) -> *const u8 {
    STATE.with(|s| s.borrow().files[i].1.as_ptr())
}
#[no_mangle]
pub extern "C" fn file_text_len(i: usize) -> usize {
    STATE.with(|s| s.borrow().files[i].1.len())
}
fn u16_at(b: &[u8], i: usize) -> Result<usize, String> {
    b.get(i..i + 2)
        .map(|s| u16::from_le_bytes(s.try_into().unwrap()) as usize)
        .ok_or("ZIP 본문이 잘렸습니다.".into())
}
fn u32_at(b: &[u8], i: usize) -> Result<usize, String> {
    b.get(i..i + 4)
        .map(|s| u32::from_le_bytes(s.try_into().unwrap()) as usize)
        .ok_or("ZIP 본문이 잘렸습니다.".into())
}
fn unzip(bytes: &[u8]) -> Result<Vec<(String, String)>, String> {
    if bytes.len() > 25 * 1024 * 1024 || bytes.len() < 22 {
        return Err("ZIP 파일은 25MB 이하의 일반 ZIP 형식이어야 합니다.".into());
    }
    let end = (bytes.len().saturating_sub(65557)..=bytes.len() - 22)
        .rev()
        .find(|&i| bytes[i..i + 4] == [0x50, 0x4b, 5, 6])
        .ok_or("일반 ZIP 형식의 노션 내보내기 파일을 선택하세요.")?;
    if u16_at(bytes, end + 4)? != 0 || u16_at(bytes, end + 6)? != 0 {
        return Err("일반 ZIP 형식을 선택하세요.".into());
    }
    let count = u16_at(bytes, end + 10)?;
    if count > 5000 {
        return Err("한 번에 최대 5000개 파일을 가져올 수 있습니다.".into());
    }
    let mut pos = u32_at(bytes, end + 16)?;
    let mut total = 0;
    let mut files = Vec::new();
    let mut names = HashSet::new();
    for _ in 0..count {
        if u32_at(bytes, pos)? != 0x02014b50 || pos + 46 > bytes.len() {
            return Err("ZIP 목록을 읽지 못했습니다.".into());
        }
        let flags = u16_at(bytes, pos + 8)?;
        let method = u16_at(bytes, pos + 10)?;
        let packed = u32_at(bytes, pos + 20)?;
        let size = u32_at(bytes, pos + 24)?;
        let name_size = u16_at(bytes, pos + 28)?;
        let extra = u16_at(bytes, pos + 30)?;
        let comment = u16_at(bytes, pos + 32)?;
        let local = u32_at(bytes, pos + 42)?;
        let end_name = pos + 46 + name_size;
        let next = end_name + extra + comment;
        if next > bytes.len() {
            return Err("ZIP 목록을 읽지 못했습니다.".into());
        }
        let name = String::from_utf8_lossy(&bytes[pos + 46..end_name]).into_owned();
        pos = next;
        if name.ends_with('/') {
            continue;
        }
        let drive = name.as_bytes().get(0).is_some_and(u8::is_ascii_alphabetic)
            && name.as_bytes().get(1) == Some(&b':');
        if name.starts_with('/')
            || drive
            || name.split(['/', '\\']).any(|s| s == "..")
            || name.contains('\0')
            || flags & 1 != 0
        {
            return Err("암호화되었거나 잘못된 ZIP 경로입니다.".into());
        }
        let lower = name.to_ascii_lowercase();
        if !lower.ends_with(".md") && !lower.ends_with(".csv") {
            continue;
        }
        total += size;
        if size > 16 * 1024 * 1024 || total > 32 * 1024 * 1024 {
            return Err("문서의 압축 해제 크기는 합계 32MB 이하여야 합니다.".into());
        }
        if u32_at(bytes, local)? != 0x04034b50 {
            return Err("ZIP 본문을 읽지 못했습니다.".into());
        }
        let start = local + 30 + u16_at(bytes, local + 26)? + u16_at(bytes, local + 28)?;
        let packed_bytes = bytes
            .get(start..start + packed)
            .ok_or("ZIP 본문이 잘렸습니다.")?;
        let decoded = match method {
            0 => packed_bytes.to_vec(),
            8 => {
                let mut out = Vec::with_capacity(size + 1);
                let status = Decompress::new(false)
                    .decompress_vec(packed_bytes, &mut out, FlushDecompress::Finish)
                    .map_err(|_| "ZIP 압축을 해제하지 못했습니다.")?;
                if status != Status::StreamEnd {
                    return Err("ZIP 압축을 해제하지 못했습니다.".into());
                }
                out
            }
            _ => return Err("지원하지 않는 ZIP 압축입니다.".into()),
        };
        if decoded.len() != size {
            return Err("지원하지 않거나 손상된 ZIP 압축입니다.".into());
        }
        if !names.insert(name.clone()) {
            return Err("중복된 ZIP 파일 경로입니다.".into());
        }
        let text = String::from_utf8_lossy(&decoded).into_owned();
        let text = text.strip_prefix('\u{feff}').unwrap_or(&text).to_string();
        files.push((name, text));
    }
    Ok(files)
}
fn js_space(c: char) -> bool {
    matches!(c,'\u{0009}'..='\u{000d}'|'\u{0020}'|'\u{00a0}'|'\u{1680}'|'\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}')
}
fn csv(text: &str) -> Result<Value, String> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut cell = String::new();
    let mut quoted = false;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '"' {
            if quoted && chars.peek() == Some(&'"') {
                cell.push('"');
                chars.next();
            } else if quoted || cell.is_empty() {
                quoted = !quoted;
            } else {
                return Err("CSV 따옴표 형식을 확인하세요.".into());
            }
        } else if !quoted && matches!(c, ',' | '\n' | '\r') {
            row.push(std::mem::take(&mut cell));
            if c != ',' {
                rows.push(std::mem::take(&mut row));
                if c == '\r' && chars.peek() == Some(&'\n') {
                    chars.next();
                }
            }
        } else {
            cell.push(c);
        }
    }
    if quoted {
        return Err("CSV 따옴표가 닫히지 않았습니다.".into());
    }
    if !cell.is_empty() || !row.is_empty() {
        row.push(cell);
        rows.push(row);
    }
    let headers = if rows.is_empty() {
        Vec::new()
    } else {
        rows.remove(0)
            .into_iter()
            .map(|s| s.trim_matches(js_space).to_string())
            .collect::<Vec<_>>()
    };
    if headers.iter().collect::<HashSet<_>>().len() != headers.len() {
        return Err("CSV에 중복된 속성 이름이 있습니다.".into());
    }
    let mut result = Vec::new();
    for row in rows {
        if row.iter().all(|s| s.trim_matches(js_space).is_empty()) {
            continue;
        }
        if row.len() != headers.len() {
            return Err("CSV의 열 개수가 일치하지 않습니다.".into());
        }
        let mut object = Map::new();
        for (key, value) in headers.iter().zip(row) {
            object.insert(
                key.clone(),
                Value::String(value.trim_matches(js_space).to_string()),
            );
        }
        result.push(Value::Object(object));
    }
    Ok(Value::Array(result))
}
#[no_mangle]
pub unsafe extern "C" fn run(op: u32, ptr: *const u8, size: usize) -> u32 {
    STATE.with(|cell| {
        let mut state = cell.borrow_mut();
        state.output.clear();
        let input = slice::from_raw_parts(ptr, size);
        let result = match op {
            1 => {
                state.files.clear();
                unzip(input).map(|files| {
                    state.files = files;
                    Value::Null
                })
            }
            2 => csv(&String::from_utf8_lossy(input)),
            _ => Err("Unknown operation".into()),
        };
        match result {
            Ok(value) => {
                state.output = serde_json::to_vec(&value).unwrap();
                0
            }
            Err(error) => {
                state.output = serde_json::to_vec(&error).unwrap();
                1
            }
        }
    })
}
fn records(mut bytes: &[u8]) -> Vec<&[u8]> {
    let mut result = Vec::new();
    while bytes.len() >= 4 {
        let size = u32::from_le_bytes(bytes[..4].try_into().unwrap()) as usize;
        bytes = &bytes[4..];
        if size > bytes.len() {
            break;
        }
        result.push(&bytes[..size]);
        bytes = &bytes[size..];
    }
    result
}
fn contains_utf16(row: &[u8], term: &[u8], finder: &memchr::memmem::Finder<'_>) -> bool {
    if term.is_empty() {
        return true;
    }
    let mut offset = 0;
    while let Some(found) = finder.find(&row[offset..]) {
        let at = offset + found;
        if at % 2 == 0 {
            return true;
        }
        offset = at + 1;
    }
    false
}
#[no_mangle]
pub unsafe extern "C" fn search(
    ptr: *const u8,
    size: usize,
    query: *const u8,
    query_size: usize,
    output: *mut u32,
) -> usize {
    let rows = records(slice::from_raw_parts(ptr, size));
    let terms = records(slice::from_raw_parts(query, query_size));
    let finders = terms
        .iter()
        .map(|term| memchr::memmem::Finder::new(term))
        .collect::<Vec<_>>();
    let mut count = 0;
    for (index, row) in rows.iter().enumerate() {
        if terms
            .iter()
            .zip(&finders)
            .all(|(term, finder)| contains_utf16(row, term, finder))
        {
            *output.add(count) = index as u32;
            count += 1;
        }
    }
    count
}

#[derive(Clone, Copy)]
struct Expiry {
    end: f64,
    lane: u32,
}
impl PartialEq for Expiry {
    fn eq(&self, b: &Self) -> bool {
        self.end == b.end && self.lane == b.lane
    }
}
impl Eq for Expiry {}
impl Ord for Expiry {
    fn cmp(&self, b: &Self) -> Ordering {
        self.end
            .partial_cmp(&b.end)
            .unwrap_or(Ordering::Equal)
            .then(self.lane.cmp(&b.lane))
    }
}
impl PartialOrd for Expiry {
    fn partial_cmp(&self, b: &Self) -> Option<Ordering> {
        Some(self.cmp(b))
    }
}
#[no_mangle]
pub unsafe extern "C" fn lanes(ptr: *const f64, count: usize, out: *mut u32) {
    let pairs = slice::from_raw_parts(ptr, count * 2);
    let mut indices = (0..count).collect::<Vec<_>>();
    indices.sort_by(|&a, &b| {
        pairs[a * 2]
            .partial_cmp(&pairs[b * 2])
            .unwrap_or(Ordering::Equal)
            .then_with(|| {
                pairs[a * 2 + 1]
                    .partial_cmp(&pairs[b * 2 + 1])
                    .unwrap_or(Ordering::Equal)
            })
    });
    let mut active: BinaryHeap<Reverse<Expiry>> = BinaryHeap::new();
    let mut free: BinaryHeap<Reverse<u32>> = BinaryHeap::new();
    let mut start = 0;
    let mut max = 0;
    let mut next = 0;
    for (position, &i) in indices.iter().enumerate() {
        let begin = pairs[i * 2];
        while active.peek().is_some_and(|e| e.0.end <= begin) {
            free.push(Reverse(active.pop().unwrap().0.lane));
        }
        if active.is_empty() && position > start {
            for j in start..position {
                *out.add(j * 3 + 2) = max;
            }
            start = position;
            max = 0;
            next = 0;
            free.clear();
        }
        let lane = free.pop().map(|v| v.0).unwrap_or_else(|| {
            let lane = next;
            next += 1;
            lane
        });
        active.push(Reverse(Expiry {
            end: pairs[i * 2 + 1].max(begin + 30.0),
            lane,
        }));
        max = max.max(active.len() as u32);
        *out.add(position * 3) = i as u32;
        *out.add(position * 3 + 1) = lane;
    }
    for j in start..count {
        *out.add(j * 3 + 2) = max;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn csv_semantics() {
        assert_eq!(
            csv("b,a\r\n\"x,y\",\"한글\"\r\n").unwrap().to_string(),
            "[{\"b\":\"x,y\",\"a\":\"한글\"}]"
        );
        assert!(csv("a,a\nx,y").is_err());
        assert!(csv("a\n\"oops").is_err());
    }
    #[test]
    fn whitespace_matches_js() {
        assert!(js_space('\u{feff}'));
        assert!(!js_space('\u{0085}'));
    }
    #[test]
    fn zip_invalid() {
        assert!(unzip(b"bad").is_err());
    }
}
