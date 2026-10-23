import {createHash} from 'node:crypto';
import {privateNotModified} from './private-revalidation.js';
import {documentFileContext} from './private-file-context.js';
import {imageDimensions} from './material-index.js';

const resources=[
 {path:'files',source:'files',table:'file_previews'},
 {path:'school/files',source:'school_files',table:'school_file_previews'},
 {path:'document-files',source:'document_files',table:'document_file_previews'}
];
export function initializeFilePreviews(db){
 for(const resource of resources)db.exec(`CREATE TABLE IF NOT EXISTS ${resource.table}(file_id TEXT NOT NULL REFERENCES ${resource.source}(id) ON DELETE CASCADE,variant TEXT NOT NULL CHECK(variant IN ('thumbnail','reference')),type TEXT NOT NULL,digest TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(file_id,variant))`);
}
export function previewUsage(db,uid){
 return resources.reduce((sum,r)=>sum+db.prepare(`SELECT COALESCE(SUM(length(p.bytes)),0) size FROM ${r.table} p JOIN ${r.source} f ON f.id=p.file_id WHERE f.user_id=?`).get(uid).size,0);
}
// Caller authorizes the ORIGINAL first. Missing derivatives never fall back to
// the original payload. This also rejects typoed preview variants explicitly.
export function serveFilePreview(db,{resource,file,req,res,session,url,json}){
 if(!url.searchParams.has('preview'))return false;
 const value=url.searchParams.get('preview');
 if(!['1','reference'].includes(value)){json(400,{error:'Invalid preview variant'});return true;}
 const r=resources.find(r=>r.path===resource);if(!r)throw Error('Unknown internal file resource');
 const variant=value==='reference'?'reference':'thumbnail',preview=db.prepare(`SELECT type,digest FROM ${r.table} WHERE file_id=? AND variant=?`).get(file.id,variant);
 if(!preview){json(404,{error:'Preview unavailable; open the original explicitly'});return true;}
 if(privateNotModified(req,res,session,resource+':'+file.id+':'+variant,preview.digest))return true;
 res.setHeader('Content-Type',preview.type);res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
 res.end(db.prepare(`SELECT bytes FROM ${r.table} WHERE file_id=? AND variant=?`).get(file.id,variant).bytes);return true;
}
export function filePreviewRoutes(db){
 initializeFilePreviews(db);
 return async({path,req,session,json,body})=>{
  const match=path.match(/^\/api\/(files|school\/files|document-files)\/([a-f0-9-]{36})\/preview$/);
  if(!match)return false;
  if(!session){json(401,{error:'Login required'});return true;}
  if(req.method!=='PUT'){json(405,{error:'Method not allowed'});return true;}
  const resource=resources.find(r=>r.path===match[1]);
  if(resource.path==='document-files'&&req.headers['x-document-context']!==documentFileContext(session)){json(409,{error:'Document image session changed'});return true;}
  const file=db.prepare(`SELECT id,type FROM ${resource.source} WHERE id=? AND user_id=?`).get(match[2],session.user_id);
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
  const prior=db.prepare(`SELECT COALESCE(SUM(length(bytes)),0) size FROM ${resource.table} WHERE file_id=?`).get(file.id);
  const usage=['files','school_files','document_files'].reduce((sum,table)=>sum+db.prepare('SELECT COALESCE(SUM(length(bytes)),0) size FROM '+table+' WHERE user_id=?').get(session.user_id).size,0)+previewUsage(db,session.user_id);
  if(usage-prior.size+smallSize+referenceSize>250*1024*1024){json(413,{error:'Storage quota reached'});return true;}
  // Both variants commit together; response-loss retry replaces the same pair.
  db.exec('BEGIN IMMEDIATE');
  try{for(const [variant,type,bytes]of rows){const digest=createHash('sha256').update(bytes).digest('hex');db.prepare(`INSERT INTO ${resource.table} VALUES(?,?,?,?,?) ON CONFLICT(file_id,variant) DO UPDATE SET type=excluded.type,digest=excluded.digest,bytes=excluded.bytes`).run(file.id,variant,type,digest,bytes);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  json(200,{stored:true});return true;
 };
}
