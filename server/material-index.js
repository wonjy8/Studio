import {validColorSummary} from '../src/domain/material-colors.js';
// Deterministic metadata only: no inference, decoder, GPS/camera-text extraction or network.
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
const frameMarkers=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
// Read only the TIFF orientation scalar in an EXIF segment. GPS directories and
// camera metadata values are never traversed or returned.
function jpegOrientation(bytes,start,end){
 if(end-start<14||bytes.toString('ascii',start,start+6)!=='Exif\0\0')return 1;const tiff=start+6,little=bytes.toString('ascii',tiff,tiff+2)==='II';if(!little&&bytes.toString('ascii',tiff,tiff+2)!=='MM')return 1;
 const u16=at=>at>=tiff&&at+2<=end?(little?bytes.readUInt16LE(at):bytes.readUInt16BE(at)):null,u32=at=>at>=tiff&&at+4<=end?(little?bytes.readUInt32LE(at):bytes.readUInt32BE(at)):null;
 if(u16(tiff+2)!==42)return 1;const offset=u32(tiff+4);if(offset===null)return 1;const directory=tiff+offset,count=u16(directory);if(count===null||count>128||directory+2+count*12>end)return 1;
 for(let i=0;i<count;i++){const at=directory+2+i*12;if(u16(at)===0x0112&&u16(at+2)===3&&u32(at+4)===1){const value=u16(at+8);return value>=1&&value<=8?value:1;}}return 1;
}
export function imageDimensions(input,type){
 if(!(input instanceof Uint8Array))return null;const bytes=Buffer.from(input.buffer,input.byteOffset,input.byteLength),valid=(width,height)=>Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=100000&&height<=100000?{width,height}:null;
 if(type==='image/png'){if(bytes.length<24||!bytes.subarray(0,8).equals(pngSignature)||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')return null;return valid(bytes.readUInt32BE(16),bytes.readUInt32BE(20));}
 if(type!=='image/jpeg'||bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
 // Stop before pixel data and cap scanning; arbitrary EXIF or malformed markers
 // cannot cause unbounded loops, image decompression or metadata disclosure.
 const end=Math.min(bytes.length,65536);let at=2,orientation=1;
 while(at+4<=end){if(bytes[at++]!==0xff)return null;while(at<end&&bytes[at]===0xff)at++;const marker=bytes[at++];if(marker===0xda||marker===0xd9)return null;if(marker===0x01||(marker>=0xd0&&marker<=0xd8))continue;if(at+2>end)return null;const size=bytes.readUInt16BE(at);if(size<2||at+size>end)return null;if(marker===0xe1)orientation=jpegOrientation(bytes,at+2,at+size);if(frameMarkers.has(marker)){if(size<8)return null;const width=bytes.readUInt16BE(at+5),height=bytes.readUInt16BE(at+3);return orientation>=5?valid(height,width):valid(width,height);}at+=size;
 }
 return null;
}
export function materialMetadata({name='',type='',bytes}={}){
 const extension=(String(name).match(/\.([a-zA-Z0-9]{1,12})$/)?.[1]||'').toLowerCase(),dimensions=imageDimensions(bytes,type);
 if(!dimensions)return {version:1,extension};const {width,height}=dimensions;
 return {version:1,extension,width,height,orientation:width===height?'square':width>height?'landscape':'portrait',aspectRatio:Math.round(width/height*10000)/10000};
}
export {materialSearchTerms} from '../src/domain/material-index.js';
export function initializeMaterialIndex(db){db.exec('CREATE TABLE IF NOT EXISTS material_file_metadata(file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL)');}
// Called only from the authenticated NEW upload transaction, never list/import.
export function indexNewMaterialUpload(db,userId,file){if(!(file.bytes instanceof Uint8Array)||!db.prepare('SELECT id FROM files WHERE id=? AND user_id=?').get(file.id,userId))throw Error('New upload owner required');db.prepare('INSERT INTO material_file_metadata VALUES(?,?,?)').run(file.id,userId,JSON.stringify({...materialMetadata(file),...validatedUploadColors(file)}));}

function validatedUploadColors(file){try{if(file.bytes.length>8*1024*1024||typeof file.colors!=='string'||file.colors.length>256)return {};const dimensions=imageDimensions(file.bytes,file.type);if(!dimensions||dimensions.width>8192||dimensions.height>8192||dimensions.width*dimensions.height>8000000)return {};const summary=JSON.parse(file.colors);return validColorSummary(summary)?{pixelSummary:summary}:{};}catch{return {};}}
