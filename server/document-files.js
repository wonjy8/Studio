import {createHash,randomUUID} from 'node:crypto';
const fail=(message,status)=>Object.assign(Error(message),{status});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function documentFileRoutes(db){
 db.exec('CREATE TABLE IF NOT EXISTS document_files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,type TEXT NOT NULL,digest TEXT NOT NULL,bytes BLOB NOT NULL,UNIQUE(user_id,digest,type));CREATE TABLE IF NOT EXISTS document_file_uploads(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,upload_key TEXT NOT NULL,file_id TEXT NOT NULL REFERENCES document_files(id) ON DELETE CASCADE,digest TEXT NOT NULL,type TEXT NOT NULL,PRIMARY KEY(user_id,upload_key))');
 const stores=[['workspaces','user_id'],['document_library','user_id'],['school_workspaces','user_id'],['scripture_notes','user_id'],['deleted_projects','owner_id'],['material_migration_backups','user_id'],['reference_boards','user_id'],['reference_library','user_id'],['contacts','user_id'],['rental_vendors','user_id'],['materials','user_id']];
 // Every current document/recoverable-content root is reviewed here. New image consumers must join this policy.
 const collect=(row,used)=>{
  const values=[];for(const [key,value]of Object.entries(row)){if(key==='body'&&value!==null){if(typeof value!=='string')throw fail('문서 사용 상태를 확인하지 못했습니다.',409);try{values.push(JSON.parse(value));}catch{throw fail('문서 사용 상태를 확인하지 못했습니다.',409);}}else values.push(value);}
  while(values.length){const value=values.pop();if(typeof value==='string'){for(const match of value.replaceAll('\\','/').matchAll(/\/api\/document-files\/([a-f0-9-]{36})/gi))used.add(match[1].toLowerCase());}else if(value&&typeof value==='object'&&!(value instanceof Uint8Array))for(const child of Object.values(value))values.push(child);}
 };
 const inspect=(uid,protectedIds)=>{
  const used=new Set(protectedIds.map(id=>id.toLowerCase()));
  for(const [table,owner]of stores){if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;for(const row of db.prepare('SELECT * FROM '+table+' WHERE '+owner+'=?').all(uid))collect(row,used);}
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='integration_content_proposals'").get())for(const row of db.prepare('SELECT * FROM integration_content_proposals WHERE user_id=? AND expires>?').all(uid,Date.now()))collect(row,used);
  const files=db.prepare('SELECT id,name,type,digest,length(bytes) size FROM document_files WHERE user_id=? ORDER BY id').all(uid).filter(file=>!used.has(file.id));
  return {files,expectedSnapshot:createHash('sha256').update(JSON.stringify([uid,[...protectedIds].sort(),files])).digest('hex')};
 };
 const context=session=>createHash('sha256').update(JSON.stringify(['document-image-v1',session.user_id,session.token])).digest('base64url');
 return async({path,req,res,session,json,body,readJson})=>{
  if(!path.startsWith('/api/document-files'))return false;
  if(!session){json(401,{error:'Login required'});return true;}const uid=session.user_id;
  if(path==='/api/document-files/context'&&req.method==='GET'){json(200,{accountId:uid,editContext:context(session)});return true;}
  if(path==='/api/document-files'&&req.method==='POST'){
   const type=req.headers['content-type'],key=req.headers['x-upload-id'];if(!['image/png','image/jpeg','image/webp'].includes(type))throw fail('PNG, JPEG, WebP 이미지를 선택하세요.',415);if(!uuid(key))throw fail('Invalid upload identifier',400);if(req.headers['x-document-context']!==context(session))throw fail('로그인 상태가 변경되었습니다. 이미지 선택을 다시 열어 주세요.',409);
   const bytes=await body(20*1024*1024),valid=type==='image/png'?bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0:type==='image/jpeg'?bytes.length>=4&&bytes.subarray(0,3).toString('hex')==='ffd8ff':bytes.length>=12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)throw fail('이미지 파일 형식을 확인하세요.',400);
   let name;try{name=decodeURIComponent(req.headers['x-file-name']||'image').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,200)||'image';}catch{throw fail('Invalid file name',400);}const digest=createHash('sha256').update(bytes).digest('hex');let file;
   db.exec('BEGIN IMMEDIATE');try{const prior=db.prepare('SELECT * FROM document_file_uploads WHERE user_id=? AND upload_key=?').get(uid,key);if(prior&&(prior.digest!==digest||prior.type!==type))throw fail('이미 선택한 파일과 업로드 내용이 다릅니다. 다시 선택하세요.',409);if(!prior&&db.prepare('SELECT count(*) n FROM document_file_uploads WHERE user_id=?').get(uid).n>=20000)throw fail('이미지 업로드 한도에 도달했습니다.',429);file=prior?db.prepare('SELECT id FROM document_files WHERE id=? AND user_id=?').get(prior.file_id,uid):db.prepare('SELECT id FROM document_files WHERE user_id=? AND digest=? AND type=?').get(uid,digest,type);
    if(!file){if(db.prepare('SELECT count(*) n FROM document_files WHERE user_id=?').get(uid).n>=10000)throw fail('문서 이미지 저장 한도에 도달했습니다.',413);const usage=['files','school_files','document_files'].reduce((sum,table)=>sum+db.prepare('SELECT COALESCE(SUM(length(bytes)),0) size FROM '+table+' WHERE user_id=?').get(uid).size,0);if(usage+bytes.length>250*1024*1024)throw fail('이미지 저장 공간이 부족합니다. 사용하지 않는 이미지 정리를 확인하세요.',413);file={id:randomUUID(),user_id:uid,name,type,digest};db.prepare('INSERT INTO document_files VALUES(?,?,?,?,?,?)').run(file.id,uid,name,type,digest,bytes);}
    if(!prior)db.prepare('INSERT INTO document_file_uploads VALUES(?,?,?,?,?)').run(uid,key,file.id,digest,type);db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}json(201,{id:file.id,url:'/api/document-files/'+file.id});return true;
  }
  if(['/api/document-files/cleanup-preview','/api/document-files/cleanup'].includes(path)&&req.method==='POST'){
   const data=await readJson(1024*1024),applying=path.endsWith('/cleanup'),allowed=applying?['editContext','protectedIds','ids','expectedSnapshot','confirm']:['editContext','protectedIds'];if(!data||Object.keys(data).some(key=>!allowed.includes(key))||data.editContext!==context(session)||!Array.isArray(data.protectedIds)||data.protectedIds.length>10000||data.protectedIds.some(id=>!uuid(id)))throw fail('이미지 정리의 로그인 상태 또는 입력을 확인하세요.',409);
   if(!applying){const preview=inspect(uid,data.protectedIds);json(200,{...preview,files:preview.files.map(({digest,...file})=>file)});return true;}
   if(data.confirm!==true||!Array.isArray(data.ids)||!data.ids.length||data.ids.length>10000||new Set(data.ids).size!==data.ids.length||data.ids.some(id=>!uuid(id))||(typeof data.expectedSnapshot!=='string'||!/^[a-f0-9]{64}$/.test(data.expectedSnapshot)))throw fail('정리할 이미지와 영구 삭제 확인이 필요합니다.',400);
   db.exec('BEGIN IMMEDIATE');try{const preview=inspect(uid,data.protectedIds),candidates=new Set(preview.files.map(file=>file.id));if(preview.expectedSnapshot!==data.expectedSnapshot||data.ids.some(id=>!candidates.has(id)))throw fail('이미지 사용 상태가 변경되었습니다. 다시 확인하세요.',409);for(const id of data.ids)db.prepare('DELETE FROM document_files WHERE id=? AND user_id=?').run(id,uid);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}json(200,{deleted:data.ids.length});return true;
  }
  const match=path.match(/^\/api\/document-files\/([a-f0-9-]{36})$/i);if(match&&req.method==='GET'){const file=db.prepare('SELECT * FROM document_files WHERE id=? AND user_id=?').get(match[1].toLowerCase(),uid);res.setHeader('Cache-Control','private, no-store');if(!file){json(404,{error:'Not found'});return true;}res.setHeader('Content-Type',file.type);res.setHeader('Content-Disposition',"inline; filename*=UTF-8''"+encodeURIComponent(file.name).replace(/'/g,'%27'));res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");res.end(file.bytes);return true;}
  json(405,{error:'Method not allowed'});return true;
 };
}
