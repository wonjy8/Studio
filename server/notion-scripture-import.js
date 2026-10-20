import {bibleBooks} from '../src/domain/bible.js';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {newBlock,newDocument,validDocuments} from '../src/domain/documents.js';
import {validDate} from '../src/domain/calendar.js';
const fail=message=>Object.assign(Error(message),{status:400});
export function readNotionZip(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length>25*1024*1024)throw fail('ZIP 파일은 25MB 이하여야 합니다.');let end=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6))throw fail('일반 ZIP 형식의 노션 내보내기 파일을 선택하세요.');const count=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);if(count>5000||count===65535)throw fail('한 번에 최대 5000개 파일을 가져올 수 있습니다.');
 let position=offset,total=0;const files=new Map();for(let n=0;n<count;n++){
  if(position+46>buffer.length||buffer.readUInt32LE(position)!==0x02014b50)throw fail('ZIP 목록을 읽지 못했습니다.');const flags=buffer.readUInt16LE(position+8),method=buffer.readUInt16LE(position+10),packed=buffer.readUInt32LE(position+20),size=buffer.readUInt32LE(position+24),nameSize=buffer.readUInt16LE(position+28),extra=buffer.readUInt16LE(position+30),comment=buffer.readUInt16LE(position+32),local=buffer.readUInt32LE(position+42);if(position+46+nameSize+extra+comment>buffer.length)throw fail('ZIP 파일이 손상되었습니다.');const name=buffer.subarray(position+46,position+46+nameSize).toString('utf8');position+=46+nameSize+extra+comment;
  if(name.endsWith('/'))continue;if(name.startsWith('/')||/^[A-Za-z]:/.test(name)||name.split(/[\\/]/).includes('..')||name.includes('\0')||flags&1)throw fail('암호화되었거나 잘못된 ZIP 경로입니다.');if(!/\.(md|csv)$/i.test(name))continue;
  total+=size;if(size>16*1024*1024||total>32*1024*1024)throw fail('문서의 압축 해제 크기는 합계 32MB 이하여야 합니다.');if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw fail('ZIP 본문을 읽지 못했습니다.');const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);if(start+packed>buffer.length)throw fail('ZIP 본문이 잘렸습니다.');let bytes;
  try{bytes=method===0?buffer.subarray(start,start+packed):method===8?inflateRawSync(buffer.subarray(start,start+packed),{maxOutputLength:Math.max(1,size+1)}):null;}catch{throw fail('ZIP 압축을 해제하지 못했습니다.');}if(!bytes||bytes.length!==size)throw fail('지원하지 않거나 손상된 ZIP 압축입니다.');if(files.has(name))throw fail('중복된 ZIP 파일 경로입니다.');files.set(name,bytes.toString('utf8').replace(/^\uFEFF/,''));
 }return files;
}
export function parseNotionCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw fail('CSV 따옴표 형식을 확인하세요.');}else if(!quoted&&[',','\n','\r'].includes(c)){row.push(cell);cell='';if(c!==','){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}else cell+=c;}if(quoted)throw fail('CSV 따옴표가 닫히지 않았습니다.');if(cell||row.length){row.push(cell);rows.push(row);}const headers=rows.shift()?.map(s=>s.trim())||[];if(new Set(headers).size!==headers.length)throw fail('CSV에 중복된 속성 이름이 있습니다.');return rows.filter(row=>row.some(s=>s.trim())).map(row=>{if(row.length!==headers.length)throw fail('CSV의 열 개수가 일치하지 않습니다.');return Object.fromEntries(headers.map((key,i)=>[key,row[i].trim()]));});}
const pageId=value=>String(value).match(/([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?=\.(?:md|csv)|\)|\/|$|\?)/i)?.[1]?.replaceAll('-','').toLowerCase();
const cleanTitle=value=>String(value).replace(/\s*\([^)]*\.md\)\s*$/i,'').replace(/\[([^\]]+)\]/g,'$1').trim();
const get=(properties,labels)=>Object.entries(properties).find(([key])=>labels.includes(key.toLowerCase().replace(/\s/g,'')))?.[1]||'';
function dateValue(value){const m=String(value).match(/(\d{4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})/);const date=m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';return validDate(date)?date:'';}
export function markdownBlocks(text){const blocks=[];let fenced=false,code=[];for(const line of text.split(/\r?\n/)){if(/^```/.test(line)){if(fenced){blocks.push(newBlock('code',code.join('\n')));code=[];}fenced=!fenced;continue;}if(fenced){code.push(line);continue;}if(!line.trim())continue;const heading=line.match(/^(#{1,6})\s+(.*)$/),todo=line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/),bullet=line.match(/^(\s*)[-*]\s+(.*)$/),number=line.match(/^(\s*)\d+[.)]\s+(.*)$/);let block;if(heading)block=newBlock('h'+Math.min(3,heading[1].length),heading[2]);else if(todo)block={...newBlock('todo',todo[2]),checked:todo[1].toLowerCase()==='x'};else if(bullet||number){const m=bullet||number;block={...newBlock(bullet?'bullet':'number',m[2]),indent:Math.min(3,Math.floor(m[1].length/2))};}else if(/^>/.test(line))block=newBlock('quote',line.replace(/^>\s?/,''));else if(/^[-*_]{3,}$/.test(line.trim()))block=newBlock('divider');else block=newBlock('paragraph',line);blocks.push(block);}if(fenced)blocks.push(newBlock('code',code.join('\n')));return blocks.length?blocks:[newBlock()];}
export function notionScriptureNotes(files){
 const pages=[...files].filter(([name])=>/\.md$/i.test(name)).map(([name,text])=>{const title=text.match(/^#\s+(.+)$/m)?.[1]||name.split('/').pop().replace(/\s+[a-f0-9-]{32,36}\.md$/i,'').replace(/\.md$/i,'');return {name,text,title,id:pageId(name)};});
 const csv=[...files].filter(([name])=>/\.csv$/i.test(name)&&!/_all\.csv$/i.test(name));const rows=csv.flatMap(([,text])=>parseNotionCsv(text));const items=[],seen=new Set(),used=new Set();
 function add(title,properties,page){const kind=/qt|큐티/i.test(get(properties,['분류','종류','유형','type','태그'])+' '+title)?'qt':'sermon',id=page?.id||pageId(Object.values(properties).join(' ')),key=id?'notion:'+id:'notion:'+createHash('sha256').update(JSON.stringify([title,properties,page?.name||''])).digest('hex');if(seen.has(key))return;seen.add(key);if(page)used.add(page.name);const document=newDocument(cleanTitle(title)||'제목 없음');document.blocks=markdownBlocks(page?.text.replace(/^#\s+.+\r?\n/,'')||Object.entries(properties).map(([key,value])=>key+': '+value).join('\n'));if(!validDocuments([document]))throw fail('문서가 너무 큽니다. 노션 내보내기를 나누어 주세요.');items.push({externalId:key,document,kind,date:dateValue(get(properties,['날짜','일자','date','설교일','묵상일','작성일'])),passage:get(properties,['본문','성경본문','성경구절','성경','말씀본문','passage']),speaker:get(properties,['설교자','목사','speaker']),sourceUrl:id?'https://www.notion.so/'+id:'',properties});}
 for(const properties of rows){const raw=get(properties,['이름','제목','name','title','말씀','설교제목'])||Object.values(properties)[0]||'',title=cleanTitle(raw),id=pageId(raw);const candidates=pages.filter(p=>id?p.id===id:p.title===title),page=candidates.length===1?candidates[0]:null;add(title,properties,page);}
 for(const page of pages)if(!used.has(page.name)&&!/^\s*\[.+\.csv\)/m.test(page.text))add(page.title,{},page);
 if(!items.length)throw fail('ZIP에서 Markdown 또는 CSV 말씀 노트를 찾지 못했습니다.');if(items.length>2000)throw fail('한 번에 최대 2000개 노트를 가져올 수 있습니다.');return items;
}

// These NIV references intentionally have no main-text verse in the supplied source.
// Omit only those empty rows; never synthesize text or renumber the surrounding verses.
const nivOmissions=new Set(['마태복음:17:21','마태복음:18:11','마태복음:23:14','마가복음:7:16','마가복음:9:44','마가복음:9:46','마가복음:11:26','마가복음:15:28','누가복음:17:36','누가복음:23:17','요한복음:5:4','사도행전:8:37','사도행전:15:34','사도행전:24:7','사도행전:28:29','로마서:16:24']);
export function notionBibleVerses(files){
 const candidates=[...files].filter(([name])=>/\.csv$/i.test(name)),preferred=candidates.filter(([name])=>!/_all\.csv$/i.test(name));
 for(const [name,text]of preferred.length?preferred:candidates){
  const rows=parseNotionCsv(text);if(!rows.length||!['구절','구약·신약','본문','성경','장','절'].every(k=>k in rows[0]))continue;
  const niv=/(?:^|[^A-Za-z])NIV(?:$|[^A-Za-z])|New International Version/i.test(name.normalize('NFKC')),seen=new Map();
  for(const [index,row]of rows.entries()){
   const book=row['성경'],chapter=Number(row['장']),verse=Number(row['절']),body=row['본문'],key=book+':'+chapter+':'+verse;
   const validReference=bibleBooks.includes(book)&&Number.isSafeInteger(chapter)&&chapter>=1&&chapter<=150&&Number.isSafeInteger(verse)&&verse>=1&&verse<=200&&['구약','신약'].includes(row['구약·신약']);
   if(!validReference||body.length>8000||(!body&&!(niv&&nivOmissions.has(key))))throw fail('성경 CSV의 책·장·절·본문을 확인하세요. (항목 '+(index+1)+': '+String(book).slice(0,80)+' '+chapter+':'+verse+')');
   if(seen.has(key)&&seen.get(key).text!==body)throw fail('같은 성경 구절에 서로 다른 본문이 있습니다. ('+book+' '+chapter+':'+verse+')');
   seen.set(key,{book,chapter,verse,text:body,testament:row['구약·신약'],order:bibleBooks.indexOf(book)});
  }
  if(seen.size>40000)throw fail('성경 구절은 40000개까지 가져올 수 있습니다.');
  const verses=[...seen.values()].filter(verse=>verse.text).sort((a,b)=>a.order-b.order||a.chapter-b.chapter||a.verse-b.verse);
  if(!verses.length)throw fail('성경 CSV에 가져올 본문이 없습니다.');
  return {name,verses};
 }
 return null;
}
