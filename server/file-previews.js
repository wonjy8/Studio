import {createHash} from 'node:crypto';
import {imageDimensions} from './material-index.js';

export function initializeFilePreviews(db){
 db.exec("CREATE TABLE IF NOT EXISTS file_previews(file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,variant TEXT NOT NULL CHECK(variant IN ('thumbnail','reference')),type TEXT NOT NULL,digest TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(file_id,variant))");
}
export function previewUsage(db,uid){
 return db.prepare('SELECT COALESCE(SUM(length(p.bytes)),0) size FROM file_previews p JOIN files f ON f.id=p.file_id WHERE f.user_id=?').get(uid).size;
}
export function filePreviewRoutes(db){
 initializeFilePreviews(db);
 return async({path,req,session,json,body})=>{
  const match=path.match(/^\/api\/files\/([a-f0-9-]{36})\/preview$/);
  if(!match)return false;
  if(!session){json(401,{error:'Login required'});return true;}
  if(req.method!=='PUT'){json(405,{error:'Method not allowed'});return true;}
  const file=db.prepare('SELECT id,type FROM files WHERE id=? AND user_id=?').get(match[1],session.user_id);
  if(!file||!['image/jpeg','image/png'].includes(file.type)){json(404,{error:'Image not found'});return true;}
  if(req.headers['content-type']!=='application/octet-stream'){json(415,{error:'Preview bundle required'});return true;}
  const types=[req.headers['x-thumbnail-type'],req.headers['x-reference-type']];
  if(types.some(type=>!['image/png','image/jpeg'].includes(type))){json(415,{error:'PNG or JPEG previews required'});return true;}
  const packet=await body(512*1024+1000000+8);
  if(packet.length<8){json(400,{error:'Invalid preview bundle'});return true;}
  const smallSize=packet.readUInt32LE(0),referenceSize=packet.readUInt32LE(4);
  if(!smallSize||smallSize>512*1024||!referenceSize||referenceSize>1000000||packet.length!==8+smallSize+referenceSize){json(400,{error:'Invalid preview sizes'});return true;}
  const rows=[['thumbnail',types[0],packet.subarray(8,8+smallSize),256],['reference',types[1],packet.subarray(8+smallSize),600]];
  for(const [,type,bytes,edge]of rows){const dimensions=imageDimensions(bytes,type);if(!dimensions||dimensions.width>edge||dimensions.height>edge){json(400,{error:'Invalid preview dimensions'});return true;}}
  const prior=db.prepare('SELECT COALESCE(SUM(length(bytes)),0) size FROM file_previews WHERE file_id=?').get(file.id);
  const usage=['files','school_files','document_files'].reduce((sum,table)=>sum+db.prepare('SELECT COALESCE(SUM(length(bytes)),0) size FROM '+table+' WHERE user_id=?').get(session.user_id).size,0)+previewUsage(db,session.user_id);
  if(usage-prior.size+smallSize+referenceSize>250*1024*1024){json(413,{error:'Storage quota reached'});return true;}
  // Both variants commit together; response-loss retry replaces the same pair.
  db.exec('BEGIN IMMEDIATE');
  try{for(const [variant,type,bytes]of rows){const digest=createHash('sha256').update(bytes).digest('hex');db.prepare('INSERT INTO file_previews VALUES(?,?,?,?,?) ON CONFLICT(file_id,variant) DO UPDATE SET type=excluded.type,digest=excluded.digest,bytes=excluded.bytes').run(file.id,variant,type,digest,bytes);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  json(200,{stored:true});return true;
 };
}
