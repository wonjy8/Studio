// Managed attachments retain the project owner's file custody. Authority is
// checked against an exact owner/project pair and actual selected-project refs;
// administrators never receive another account's unrestricted file endpoint.
import {randomUUID} from 'node:crypto';
import {siteRole,siteCapabilities} from './site-roles.js';
import {validateWorkspace} from '../src/domain/workspace.js';
const maxBytes=10*1024*1024,maxJson=14*1024*1024,quota=250*1024*1024;
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const projects=state=>[state,...(state.projects||[])];
const types=['application/pdf','image/png','image/jpeg','image/webp'];
function actor(db,session){const uid=session?.user_id;if(!uid)fail(401,'Login required');if(!siteCapabilities(db,uid).canManageProjects)fail(403,'Project administration required');if(!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,uid,Date.now()))fail(401,'Session changed. Sign in again');if(db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(uid))fail(403,'Password change required');return siteRole(db,uid);}
function selected(db,owner,pid){const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(owner);if(!row)fail(404,'Project not found');const state=JSON.parse(row.body),project=projects(state).find(p=>(p.project.id||'project-main')===pid);if(!project)fail(404,'Project not found');return {revision:row.revision,state,project};}
function actualReferences(project){return [...project.refs.flatMap(ref=>ref.images.map(url=>({id:/^\/api\/files\/([a-f0-9-]{36})$/.exec(url)?.[1],target:{kind:'reference',entityId:ref.id}}))),...project.contents.filter(shoot=>shoot.scriptFile).map(shoot=>({id:shoot.scriptFile,target:{kind:'shoot',entityId:shoot.id}}))].filter(ref=>ref.id);}
const fileURL=(owner,pid,id)=>`/api/admin/projects/${encodeURIComponent(owner)}/${encodeURIComponent(pid)}/files/${id}`;
export function managedProjectAttachments(db,owner,pid,project){return actualReferences(project).flatMap(ref=>{const file=db.prepare('SELECT id,name,type,length(bytes) AS size FROM files WHERE id=? AND user_id=?').get(ref.id,owner);return file&&types.includes(file.type)?[{...file,url:fileURL(owner,pid,file.id),target:ref.target}]:[];});}
function signature(type,bytes){return type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':type==='image/png'?bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a':type==='image/jpeg'?bytes.subarray(0,3).toString('hex')==='ffd8ff':type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';}
function keys(value,allowed){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));}
function input(data,upload){if(!keys(data,upload?['revision','reason','target','file']:['revision','reason','target'])||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>500||/[\u0000-\u001f\u007f]/.test(data.reason)||!keys(data.target,['kind','entityId'])||!['reference','shoot'].includes(data.target.kind)||typeof data.target.entityId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(data.target.entityId))fail(400,'Revision, reason and selected attachment target required');}
function decode(file,kind){if(!keys(file,['name','type','base64'])||typeof file.name!=='string'||!file.name.trim()||file.name.length>200||!file.name.isWellFormed()||/[\u0000-\u001f\u007f]/.test(file.name)||!types.includes(file.type))fail(400,'Valid attachment name and type required');if((kind==='shoot'&&file.type!=='application/pdf')||(kind==='reference'&&!file.type.startsWith('image/')))fail(415,'Shoot scripts require PDF; references require PNG, JPEG or WebP');if(typeof file.base64==='string'&&file.base64.length>4*Math.ceil(maxBytes/3))fail(413,'Attachment exceeds 10 MB');if(typeof file.base64!=='string'||!file.base64.length||(file.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)))fail(400,'Canonical base64 attachment required');const bytes=Buffer.from(file.base64,'base64');if(bytes.length>maxBytes)fail(413,'Attachment exceeds 10 MB');if(!bytes.length||bytes.toString('base64')!==file.base64||!signature(file.type,bytes))fail(400,'Attachment signature or encoding invalid');return bytes;}
function entity(project,target){const value=(target.kind==='reference'?project.refs:project.contents).find(item=>item.id===target.entityId);if(!value)fail(404,'Selected attachment target not found');return value;}
function audit(db,session,grade,owner,pid,operation,revision,reason){db.prepare('INSERT INTO admin_project_audit VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),session.user_id,grade,owner,pid,operation,revision,reason,Date.now());}
export function adminProjectFileRoutes(db){return async({path,url,req,res,session,json,readJson})=>{
 const route=path.match(/^\/api\/admin\/projects\/([A-Za-z0-9_-]{1,100})\/([A-Za-z0-9_-]{1,80})\/files(?:\/([a-f0-9-]{36}))?$/);if(!route)return false;const [,owner,pid,fileId]=route;
 try{actor(db,session);if(!((req.method==='GET'&&fileId)||(req.method==='POST'&&!fileId)||(req.method==='DELETE'&&fileId)))fail(404,'Not found');
  let data,bytes;if(req.method!=='GET'){data=await readJson(req.method==='POST'?maxJson:16384);input(data,req.method==='POST');if(req.method==='POST')bytes=decode(data.file,data.target.kind);}
  db.exec('BEGIN IMMEDIATE');let response,file;
  try{const grade=actor(db,session),current=selected(db,owner,pid);
   if(req.method==='GET'){
    if(!actualReferences(current.project).some(ref=>ref.id===fileId))fail(404,'Attachment not found');file=db.prepare('SELECT * FROM files WHERE id=? AND user_id=?').get(fileId,owner);if(!file)fail(404,'Attachment not found');file.bytes=Buffer.from(file.bytes);if(typeof file.name!=='string'||!file.name.isWellFormed()||!types.includes(file.type)||!signature(file.type,file.bytes))fail(415,'Unsupported attachment');audit(db,session,grade,owner,pid,'file-read:'+fileId,current.revision,'');
   }else{
    if(data.revision!==current.revision)fail(409,'Workspace changed. Reload before editing.');const item=entity(current.project,data.target);
    if(req.method==='POST'){
     const usage=db.prepare('SELECT COALESCE(SUM(length(bytes)),0) size FROM files WHERE user_id=?').get(owner).size;if(usage+bytes.length>quota)fail(413,'Project owner storage quota reached');
     const id=randomUUID();db.prepare('INSERT INTO files(id,user_id,name,type,bytes) VALUES(?,?,?,?,?)').run(id,owner,data.file.name.trim(),data.file.type,bytes);
     if(data.target.kind==='reference')item.images.push('/api/files/'+id);else {item.scriptFile=id;item.script=true;}
     response={file:{id,name:data.file.name.trim(),type:data.file.type,size:bytes.length,url:fileURL(owner,pid,id)},target:data.target};
     audit(db,session,grade,owner,pid,`file-upload:${data.target.kind}:${data.target.entityId}:${id}`,current.revision+1,data.reason.trim());
    }else{
     if(!db.prepare('SELECT id FROM files WHERE id=? AND user_id=?').get(fileId,owner))fail(404,'Attachment not found');
     if(data.target.kind==='reference'){const url='/api/files/'+fileId;if(!item.images.includes(url))fail(404,'Selected attachment link not found');item.images=item.images.filter(value=>value!==url);}else {if(item.scriptFile!==fileId)fail(404,'Selected attachment link not found');delete item.scriptFile;item.script=false;}
     response={ok:true,target:data.target};audit(db,session,grade,owner,pid,`file-unlink:${data.target.kind}:${data.target.entityId}:${fileId}`,current.revision+1,data.reason.trim());
    }
    // Direct selected-project JSON persistence avoids equipment reconciliation or
    // changes to any other project, global settings, grants or canonical records.
    if(!validateWorkspace(current.state))fail(400,'Invalid project attachment change');const saved=db.prepare('UPDATE workspaces SET body=?,revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(current.state),owner,current.revision);if(!saved.changes)fail(409,'Workspace changed. Reload before editing.');response.revision=current.revision+1;
   }
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  if(file){res.setHeader('Content-Type',file.type);res.setHeader('Content-Length',file.bytes.length);res.setHeader('Content-Disposition',`${url?.searchParams.has('download')?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`);res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');res.writeHead(200);res.end(file.bytes);}else json(req.method==='POST'?201:200,response);return true;
 }catch(error){json(error.status||500,{error:error.status?error.message:'Managed attachment request failed'});return true;}
};}
