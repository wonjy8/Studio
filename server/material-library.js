import {randomUUID} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

const privateV4=ip=>{
 const p=ip.split('.').map(Number),a=p[0],b=p[1];
 return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===198&&(b===18||b===19));
};
const publicAddress=ip=>{
 const version=isIP(ip);
 if(version===4)return !privateV4(ip);
 if(version!==6)return false;
 const value=ip.toLowerCase();
 if(value.startsWith('::ffff:'))return publicAddress(value.slice(7));
 if(value==='::'||value==='::1'||value.startsWith('fc')||value.startsWith('fd')||/^fe[89ab]/.test(value)||value.startsWith('2001:db8:'))return false;
 const first=parseInt(value.split(':')[0]||'0',16);
 return first>=0x2000&&first<=0x3fff;
};
function normalizedLink(value){
 if(typeof value!=='string'||value.length>2000||value!==value.trim())return null;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname)return null;return url;}catch{return null;}
}
async function publicLink(url){
 if(isIP(url.hostname))return publicAddress(url.hostname);
 if(url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local'))return false;
 try{const addresses=await lookup(url.hostname,{all:true,verbatim:true});return addresses.length>0&&addresses.every(item=>publicAddress(item.address));}catch{return false;}
}
async function readLimited(response,limit){
 const reader=response.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Preview too large');}chunks.push(value);}
 return new TextDecoder().decode(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))));
}
const decode=value=>String(value||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim();
const meta=(html,key)=>{for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const name=tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];if(name!==key)continue;return decode(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]||'');}return '';};
async function previewFor(input){
 let url=normalizedLink(input);if(!url)return {};
 for(let redirects=0;redirects<=3;redirects++){
  if(url.protocol!=='https:'||!(await publicLink(url)))return {};
  let response;
  try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(3500),headers:{'Accept':'text/html','User-Agent':'StudioPreview/1.0'}});}catch{return {};}
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)return {};url=normalizedLink(new URL(location,url).href);if(!url)return {};continue;}
  if(!response.ok||!/^text\/html\b/i.test(response.headers.get('content-type')||''))return {};
  try{
   const html=await readLimited(response,1024*1024);
   const title=meta(html,'og:title')||meta(html,'twitter:title')||(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
   const description=meta(html,'og:description')||meta(html,'description')||meta(html,'twitter:description');
   const image=meta(html,'og:image')||meta(html,'twitter:image');
   let imageUrl='';try{if(image){const parsed=new URL(image,url);if(['https:','http:'].includes(parsed.protocol))imageUrl=parsed.href;}}catch{}
   return {previewTitle:decode(title).slice(0,300),previewDescription:description.slice(0,1000),previewImage:imageUrl};
  }catch{return {};}
 }
 return {};
}
async function imageFor(input){
 let url=normalizedLink(input);if(!url)return null;
 for(let redirects=0;redirects<=3;redirects++){
  if(url.protocol!=='https:'||!(await publicLink(url)))return null;
  let response;try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(3500),headers:{'Accept':'image/jpeg,image/png,image/webp,image/gif','User-Agent':'StudioPreview/1.0'}});}catch{return null;}
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)return null;try{url=normalizedLink(new URL(location,url).href);}catch{return null;}if(!url)return null;continue;}
  const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();if(!response.ok||!['image/jpeg','image/png','image/webp','image/gif'].includes(type))return null;
  const length=Number(response.headers.get('content-length')||0);if(length>4*1024*1024)return null;
  const reader=response.body?.getReader();if(!reader)return null;const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024){await reader.cancel();return null;}chunks.push(Buffer.from(value));}
  return {bytes:Buffer.concat(chunks),type};
 }
 return null;
}
const parseTags=value=>{
 const tags=Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
 const clean=[...new Set(tags.map(tag=>String(tag).trim().replace(/^#/,'')).filter(Boolean))];
 if(clean.length>20||clean.some(tag=>tag.length>40))return null;
 return clean;
};
function serialize(row){
 return {id:row.id,kind:row.kind,fileId:row.file_id||null,fileName:row.file_name||null,mimeType:row.mime_type||null,size:row.size??null,url:row.url||'',title:row.title,description:row.description||'',category:row.category||'',tags:JSON.parse(row.tags||'[]'),previewTitle:row.preview_title||'',previewDescription:row.preview_description||'',previewImage:row.preview_image||'',uploadedAt:row.uploaded_at||null};
}
export function registerMaterialFile(db,userId,file){
 const now=Date.now();
 db.prepare("INSERT INTO materials(id,user_id,kind,file_id,title,description,category,tags,uploaded_at,created_at,updated_at) VALUES(?,?,'file',?,?,?,'','[]',?,?,?) ON CONFLICT(user_id,file_id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at").run(file.id,userId,file.id,file.name,'',now,now,now);
}
export async function registerReferenceLink(db,userId,reference){
 const url=normalizedLink(reference.url);if(!url)return null;
 const existing=db.prepare("SELECT id FROM materials WHERE user_id=? AND kind='link' AND url=?").get(userId,url.href);if(existing)return existing.id;
 const tags=parseTags(reference.tags)||[],preview=await previewFor(url.href),now=Date.now(),id=randomUUID();
 db.prepare("INSERT INTO materials(id,user_id,kind,file_id,url,title,description,category,tags,preview_title,preview_description,preview_image,uploaded_at,created_at,updated_at) VALUES(?,?,'link',NULL,?,?,?,?,?,?,?,?,?,?,?)").run(id,userId,url.href,reference.name||preview.previewTitle||url.hostname,reference.notes||'',reference.collection||'',JSON.stringify(tags),preview.previewTitle||'',preview.previewDescription||'',preview.previewImage||'',now,now,now);
 return id;
}
export function registerNewAccountDocuments(db,userId,current,next){
 const previous=new Set((current||[]).map(doc=>doc.id));
 for(const doc of next||[])if(!previous.has(doc.id))db.prepare('INSERT OR IGNORE INTO material_document_dates VALUES(?,?,?,?)').run(userId,'account',doc.id,Date.now());
}
export function registerNewProjectDocuments(db,userId,next,previous){
 const oldByProject=new Map([previous,...(previous?.projects||[])].filter(Boolean).map(project=>[project.project.id||'project-main',new Set((project.documents||[]).map(doc=>doc.id))]));
 for(const project of [next,...(next.projects||[])])for(const doc of project.documents||[])if(!oldByProject.get(project.project.id||'project-main')?.has(doc.id))db.prepare('INSERT OR IGNORE INTO material_document_dates VALUES(?,?,?,?)').run(userId,project.project.id||'project-main',doc.id,Date.now());
}
export function materialLibraryRoutes(db){
 db.exec("CREATE TABLE IF NOT EXISTS materials(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('file','link')),file_id TEXT REFERENCES files(id) ON DELETE CASCADE,url TEXT,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '[]',preview_title TEXT NOT NULL DEFAULT '',preview_description TEXT NOT NULL DEFAULT '',preview_image TEXT NOT NULL DEFAULT '',uploaded_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(user_id,file_id),CHECK((kind='file' AND file_id IS NOT NULL AND url IS NULL) OR (kind='link' AND file_id IS NULL AND url IS NOT NULL)))");
 db.prepare("INSERT OR IGNORE INTO materials(id,user_id,kind,file_id,url,title,description,category,tags,uploaded_at,created_at,updated_at) SELECT id,user_id,'file',id,NULL,name,'','','[]',NULL,0,0 FROM files").run();
 db.exec('CREATE TABLE IF NOT EXISTS material_document_dates(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,project_id TEXT NOT NULL,document_id TEXT NOT NULL,created_at INTEGER,PRIMARY KEY(user_id,project_id,document_id))');
 for(const row of db.prepare('SELECT user_id,body FROM document_library').all())for(const doc of JSON.parse(row.body))db.prepare('INSERT OR IGNORE INTO material_document_dates VALUES(?,?,?,NULL)').run(row.user_id,'account',doc.id);
 for(const row of db.prepare('SELECT user_id,body FROM workspaces').all()){const state=JSON.parse(row.body);for(const project of [state,...(state.projects||[])])for(const doc of project.documents||[])db.prepare('INSERT OR IGNORE INTO material_document_dates VALUES(?,?,?,NULL)').run(row.user_id,project.project.id||'project-main',doc.id);}
 const documentDates=userId=>Object.fromEntries(db.prepare('SELECT project_id,document_id,created_at FROM material_document_dates WHERE user_id=?').all(userId).map(row=>[row.project_id+':'+row.document_id,row.created_at]));
 const query=userId=>db.prepare("SELECT m.*,f.name file_name,f.type mime_type,length(f.bytes) size FROM materials m LEFT JOIN files f ON f.id=m.file_id AND f.user_id=m.user_id WHERE m.user_id=? ORDER BY COALESCE(m.uploaded_at,m.created_at) DESC,m.rowid DESC").all(userId).map(serialize);
 return async({path,req,res,session,json,readJson})=>{
  if(!path.startsWith('/api/materials'))return false;
  if(!session){json(401,{error:'Login required'});return true;}
  const uid=session.user_id,imageMatch=path.match(/^\/api\/materials\/([a-f0-9-]{36})\/preview-image$/),match=path.match(/^\/api\/materials(?:\/([a-f0-9-]{36}))?$/),fail=(status,message)=>{throw Object.assign(Error(message),{status});};
  if(imageMatch&&req.method==='GET'){
   const row=db.prepare("SELECT preview_image FROM materials WHERE id=? AND user_id=? AND kind='link'").get(imageMatch[1],uid);
   if(!row?.preview_image){json(404,{error:'Not found'});return true;}
   const image=await imageFor(row.preview_image);if(!image){json(404,{error:'Preview unavailable'});return true;}
   res.setHeader('Content-Type',image.type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, max-age=3600');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.end(image.bytes);return true;
  }
  if(!match){json(404,{error:'Not found'});return true;}
  if(!match[1]&&req.method==='GET'){
   if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reference_library'").get())for(const row of db.prepare('SELECT body FROM reference_library WHERE user_id=?').all(uid)){
    const ref=JSON.parse(row.body),url=normalizedLink(ref.url||'');if(!url||db.prepare("SELECT id FROM materials WHERE user_id=? AND kind='link' AND url=?").get(uid,url.href))continue;
    const preview=await previewFor(url.href),now=Date.now(),id=randomUUID();
    db.prepare("INSERT INTO materials(id,user_id,kind,file_id,url,title,description,category,tags,preview_title,preview_description,preview_image,uploaded_at,created_at,updated_at) VALUES(?,?,'link',NULL,?,?,?,?,?,?,?,?,?,?,?)").run(id,uid,url.href,ref.name||preview.previewTitle||url.hostname,ref.notes||'',ref.collection||'',JSON.stringify(parseTags(ref.tags)||[]),preview.previewTitle||'',preview.previewDescription||'',preview.previewImage||'',now,now,now);
   }
   json(200,{items:query(uid),documentDates:documentDates(uid)});return true;
  }
  if(!match[1]&&req.method==='POST'){
   const data=await readJson(8192),url=normalizedLink(data?.url),tags=parseTags(data?.tags);
   if(!data||!url||!tags||typeof data.title!=='string'||data.title.length>300||typeof (data.category||'')!=='string'||(data.category||'').length>80||typeof (data.description||'')!=='string'||(data.description||'').length>1000)fail(400,'링크 정보를 확인해 주세요.');
   const preview=await previewFor(url.href),now=Date.now(),id=randomUUID(),title=data.title.trim()||preview.previewTitle||url.hostname;
   db.prepare("INSERT INTO materials(id,user_id,kind,file_id,url,title,description,category,tags,preview_title,preview_description,preview_image,uploaded_at,created_at,updated_at) VALUES(?,?,'link',NULL,?,?,?,?,?,?,?,?,?,?,?)").run(id,uid,url.href,title,data.description.trim(),(data.category||'').trim(),JSON.stringify(tags),preview.previewTitle||'',preview.previewDescription||'',preview.previewImage||'',now,now,now);
   json(201,{item:query(uid).find(item=>item.id===id)});return true;
  }
  const old=db.prepare('SELECT * FROM materials WHERE id=? AND user_id=?').get(match[1],uid);if(!old){json(404,{error:'Material not found'});return true;}
  if(req.method==='PUT'){
   const data=await readJson(8192),tags=parseTags(data?.tags);
   if(!data||typeof data.title!=='string'||!data.title.trim()||data.title.length>300||typeof (data.category||'')!=='string'||(data.category||'').length>80||typeof (data.description||'')!=='string'||(data.description||'').length>1000||!tags){json(400,{error:'자료 정보를 확인해 주세요.'});return true;}
   db.prepare('UPDATE materials SET title=?,description=?,category=?,tags=?,updated_at=? WHERE id=? AND user_id=?').run(data.title.trim(),data.description.trim(),(data.category||'').trim(),JSON.stringify(tags),Date.now(),old.id,uid);
   json(200,{item:query(uid).find(item=>item.id===old.id)});return true;
  }
  if(req.method==='DELETE'){
   if(old.kind==='file'){
    let used=false;
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reference_library'").get())for(const row of db.prepare('SELECT body FROM reference_library WHERE user_id=?').all(uid)){const ref=JSON.parse(row.body);if((ref.files||[]).includes(old.file_id)||(ref.images||[]).includes('/api/files/'+old.file_id))used=true;}
    if(!used)for(const row of db.prepare('SELECT body FROM workspaces WHERE user_id=?').all(uid)){const state=JSON.parse(row.body);for(const project of [state,...(state.projects||[])])if(project.contents?.some(shoot=>shoot.scriptFile===old.file_id))used=true;}
    if(used){json(422,{error:'다른 레퍼런스나 대본에서 사용 중인 자료입니다. 먼저 연결을 해제해 주세요.'});return true;}
    db.prepare('DELETE FROM files WHERE id=? AND user_id=?').run(old.file_id,uid);
   }else db.prepare('DELETE FROM materials WHERE id=? AND user_id=?').run(old.id,uid);
   json(200,{ok:true});return true;
  }
  json(405,{error:'Method not allowed'});return true;
 };
}
