//! Bounded derivative generation only. The original upload is never rewritten.
use image::{ImageDecoder, ImageFormat, ImageReader};
use std::{cell::RefCell, io::Cursor};

const MAX_INPUT: usize = 8 * 1024 * 1024;
const MAX_PIXELS: u64 = 8_000_000;
const MAX_OUTPUT: usize = 512 * 1024;
const MAX_REFERENCE: usize = 1_000_000;
thread_local! { static REFERENCE: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }
thread_local! { static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }

fn derivatives(bytes: &[u8]) -> Result<(Vec<u8>,Vec<u8>), &'static str> {
    if bytes.is_empty() || bytes.len() > MAX_INPUT { return Err("input limit"); }
    let format = image::guess_format(bytes).map_err(|_| "unsupported format")?;
    if !matches!(format, ImageFormat::Png | ImageFormat::Jpeg) { return Err("unsupported format"); }
    // Do not flatten animation or silently discard an embedded color profile.
    if format == ImageFormat::Png {
        let mut pos = 8usize;
        while pos + 12 <= bytes.len() {
            let size = u32::from_be_bytes(bytes[pos..pos + 4].try_into().unwrap()) as usize;
            let end = pos.checked_add(size).and_then(|p| p.checked_add(12)).ok_or("chunk limit")?;
            if end > bytes.len() { return Err("truncated chunk"); }
            if matches!(&bytes[pos + 4..pos + 8], b"acTL" | b"iCCP" | b"cHRM") { return Err("animation or color profile"); }
            if &bytes[pos+4..pos+8]==b"gAMA" && (size!=4 || u32::from_be_bytes(bytes[pos+8..pos+12].try_into().unwrap())!=45455) { return Err("non-sRGB gamma"); }
            pos = end;
        }
    } else {
        if bytes.windows(12).any(|part| part == b"ICC_PROFILE\0") { return Err("color profile"); }
        let mut pos=2usize;
        while pos+4<=bytes.len() {
            if bytes[pos]!=255 { return Err("invalid JPEG marker"); }
            let marker=bytes[pos+1];if marker==218 || marker==217 { break; }
            let size=u16::from_be_bytes([bytes[pos+2],bytes[pos+3]]) as usize;
            if size<2 || pos+size+2>bytes.len() { return Err("invalid JPEG segment"); }
            if matches!(marker,192|193|194) && size>=8 && bytes[pos+9]==4 { return Err("CMYK preview unsupported"); }
            pos+=size+2;
        }
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(64 * 1024 * 1024);
    reader.limits(limits);
    let mut decoder = reader.into_decoder().map_err(|_| "invalid image")?;
    let (width, height) = decoder.dimensions();
    if u64::from(width) * u64::from(height) > MAX_PIXELS { return Err("pixel limit"); }
    let orientation = decoder.orientation().map_err(|_| "invalid orientation")?;
    let mut image = image::DynamicImage::from_decoder(decoder).map_err(|_| "decode failed")?;
    image.apply_orientation(orientation);
    let thumbnail = image.thumbnail(256.min(image.width()),256.min(image.height()));
    let mut result = Cursor::new(Vec::new());
    if format == ImageFormat::Jpeg {
        let rgb = thumbnail.into_rgb8();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut result, 78)
            .encode(&rgb, rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
            .map_err(|_| "encode failed")?;
    } else {
        thumbnail.write_to(&mut result, ImageFormat::Png).map_err(|_| "encode failed")?;
    }
    let result = result.into_inner();
    if result.len() > MAX_OUTPUT { return Err("output limit"); }
    let reference=image.thumbnail(600.min(image.width()),600.min(image.height()));
    let mut medium=Cursor::new(Vec::new());
    if format==ImageFormat::Jpeg {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut medium,82)
            .encode_image(&reference).map_err(|_| "encode failed")?;
    } else {
        reference.write_to(&mut medium,ImageFormat::Png).map_err(|_| "encode failed")?;
    }
    let medium=medium.into_inner();
    if medium.len()>MAX_REFERENCE { return Err("reference preview limit"); }
    Ok((medium,result))
}

#[cfg(test)]
fn preview(bytes: &[u8]) -> Result<Vec<u8>, &'static str> { derivatives(bytes).map(|(_,p)| p) }


// The worker owns allocation lifetime. Input is copied into WASM once, output
// once out; no full-resolution RGBA crosses the JS/WASM boundary.
#[no_mangle]
pub extern "C" fn allocate(length: usize) -> *mut u8 {
    if length == 0 || length > MAX_INPUT { return std::ptr::null_mut(); }
    let bytes = vec![0u8; length].into_boxed_slice();
    Box::into_raw(bytes) as *mut u8
}
#[no_mangle]
pub unsafe extern "C" fn release(pointer: *mut u8, length: usize) {
    if !pointer.is_null() && length > 0 && length <= MAX_INPUT {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer, length)));
    }
}
#[no_mangle]
pub unsafe extern "C" fn generate(pointer: *const u8, length: usize) -> u32 {
    OUTPUT.with(|out| out.borrow_mut().clear());
    REFERENCE.with(|out| out.borrow_mut().clear());
    if pointer.is_null() || length == 0 || length > MAX_INPUT { return 0; }
    match derivatives(std::slice::from_raw_parts(pointer, length)) {
        Ok((reference,value)) => { OUTPUT.with(|out| *out.borrow_mut() = value); REFERENCE.with(|out| *out.borrow_mut() = reference);1 }
        Err(_) => 0,
    }
}
#[no_mangle]
pub extern "C" fn output_pointer() -> *const u8 { OUTPUT.with(|out| out.borrow().as_ptr()) }
#[no_mangle]
pub extern "C" fn output_length() -> usize { OUTPUT.with(|out| out.borrow().len()) }

#[no_mangle]
pub extern "C" fn reference_pointer() -> *const u8 { REFERENCE.with(|out| out.borrow().as_ptr()) }
#[no_mangle]
pub extern "C" fn reference_length() -> usize { REFERENCE.with(|out| out.borrow().len()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_malformed_unsupported_and_oversize() {
        assert!(preview(b"not an image").is_err());
        assert!(preview(&vec![0; MAX_INPUT + 1]).is_err());
        assert!(preview(b"GIF89a").is_err());
    }
    #[test]
    fn preserves_png_alpha_and_bounds_dimensions() {
        let img = image::RgbaImage::from_pixel(1600, 900, image::Rgba([31, 74, 117, 91]));
        let mut encoded = Cursor::new(Vec::new());
        img.write_to(&mut encoded, ImageFormat::Png).unwrap();
        let output = preview(&encoded.into_inner()).unwrap();
        let decoded = image::load_from_memory(&output).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (256, 144));
        assert_eq!(decoded.to_rgba8().get_pixel(0, 0).0[3], 91);
    }
    #[test]
    fn reference_size_no_upscale_and_exif_orientation() {
        let image=image::RgbImage::from_pixel(2,1,image::Rgb([40,80,120]));
        let mut jpeg=Vec::new();image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg,95).encode_image(&image).unwrap();
        let exif=b"Exif\0\0II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0";
        let mut rotated=jpeg[..2].to_vec();rotated.extend([255,225]);rotated.extend(((exif.len()+2) as u16).to_be_bytes());rotated.extend(exif);rotated.extend(&jpeg[2..]);
        let (reference,small)=derivatives(&rotated).unwrap();
        for bytes in [reference,small] {let decoded=image::load_from_memory(&bytes).unwrap();assert_eq!((decoded.width(),decoded.height()),(1,2));}
        let mut profile=jpeg[..2].to_vec();profile.extend([255,226,0,16]);profile.extend(b"ICC_PROFILE\0\x01\x01");profile.extend(&jpeg[2..]);assert!(derivatives(&profile).is_err());
    }
    #[test]
    fn pixel_bomb_and_animation_are_rejected_before_decode() {
        let image=image::RgbaImage::from_pixel(3000,3000,image::Rgba([0,0,0,0]));
        let mut png=Cursor::new(Vec::new());image.write_to(&mut png,ImageFormat::Png).unwrap();
        assert_eq!(derivatives(&png.into_inner()).unwrap_err(),"pixel limit");
        let image=image::RgbaImage::from_pixel(1,1,image::Rgba([0,0,0,0]));let mut png=Cursor::new(Vec::new());image.write_to(&mut png,ImageFormat::Png).unwrap();let bytes=png.into_inner();
        let mut animated=bytes[..33].to_vec();animated.extend([0,0,0,8]);animated.extend(b"acTL");animated.extend([0,0,0,1,0,0,0,0,0,0,0,0]);animated.extend(&bytes[33..]);assert_eq!(derivatives(&animated).unwrap_err(),"animation or color profile");
    }

}
