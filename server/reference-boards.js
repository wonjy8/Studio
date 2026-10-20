const columnCount=12;
const isSafePosition=item=>Number.isInteger(item.x)&&item.x>=0&&item.x<columnCount&&Number.isInteger(item.y)&&item.y>=0&&item.y<=500&&Number.isInteger(item.w)&&item.w>=2&&item.w<=columnCount&&item.x+item.w<=columnCount&&Number.isInteger(item.h)&&item.h>=2&&item.h<=12;
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const fileIdFromUrl=value=>value.match(/^\/api\/files\/([a-f0-9-]{36})$/)?.[1]||'';
const validLink=value=>{try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
export function referenceBoardRoutes(db){
 db.exec('CREATE TABLE IF NOT EXISTS reference_boards(user_id TEXT NOT NULL REFERENCES users(id),reference_id TEXT NOT NULL,body TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,reference_id))');
 return async({path,req,session,json,readJson})=>{
  const match=path.match(/^\/api\/reference-boards\/([A-Za-z0-9_-]{1,80})$/);if(!match)return false;
  if(!session){json(401,{error:'Login required'});return true;}
  const uid=session.user_id,referenceId=match[1],row=db.prepare('SELECT body FROM reference_library WHERE id=? AND user_id=?').get(referenceId,uid);
  if(!row){db.prepare('DELETE FROM reference_boards WHERE user_id=? AND reference_id=?').run(uid,referenceId);json(404,{error:'Reference not found'});return true;}
  const reference=JSON.parse(row.body),media=[];
  for(const url of reference.images||[]){const fileId=fileIdFromUrl(url);if(fileId)media.push({key:'image:'+url,kind:'image',imageUrl:url,fileId,...(db.prepare('SELECT name,type FROM files WHERE id=? AND user_id=?').get(fileId,uid)||{})});}
  for(const fileId of reference.files||[]){const file=db.prepare('SELECT name,type FROM files WHERE id=? AND user_id=?').get(fileId,uid);if(file)media.push({key:'file:'+fileId,kind:'file',fileId,...file});}
  if(reference.url&&validLink(reference.url))media.push({key:'link',kind:'link',url:reference.url,title:reference.name});
  const stored=db.prepare('SELECT body,updated_at FROM reference_boards WHERE user_id=? AND reference_id=?').get(uid,referenceId);
  let saved=[];try{saved=stored?JSON.parse(stored.body).items||[]:[];}catch{}
  const byKey=new Map(saved.filter(item=>item&&typeof item.key==='string').map(item=>[item.key,item]));
  const items=media.map((item,index)=>{const prior=byKey.get(item.key)||{},fallback={x:(index%3)*4,y:Math.floor(index/3)*5,w:4,h:4};return {...item,...fallback,...(isSafePosition(prior)?{x:prior.x,y:prior.y,w:prior.w,h:prior.h}:{})};});
  for(const item of saved){if(item?.kind==='text'&&/^text:[A-Za-z0-9_-]{1,80}$/.test(item.key||'')&&isSafePosition(item)&&typeof item.text==='string'&&item.text.length<=10000&&typeof (item.title||'')==='string'&&(item.title||'').length<=200)items.push({key:item.key,kind:'text',title:item.title||'',text:item.text,x:item.x,y:item.y,w:item.w,h:item.h});}
  const occupied=[];let validLayout=true;for(const item of items){if(!isSafePosition(item)||occupied.some(other=>overlaps(item,other))){validLayout=false;break;}occupied.push(item);}
  if(!validLayout){const clean=media.map((item,index)=>({...item,x:(index%3)*4,y:Math.floor(index/3)*5,w:4,h:4}));items.splice(0,items.length,...clean);}
  if(req.method==='GET'){json(200,{items,updatedAt:stored?.updated_at||null});return true;}
  if(req.method!=='PUT'){json(405,{error:'Method not allowed'});return true;}
  const data=await readJson(128*1024);if(!Array.isArray(data?.items)||data.items.length>150){json(400,{error:'Invalid board'});return true;}
  const mediaKeys=new Set(media.map(item=>item.key)),seen=new Set(),clean=[];let textCount=0;
  for(const item of data.items){
   if(!item||typeof item!=='object'||typeof item.key!=='string'||seen.has(item.key)||!isSafePosition(item)){json(400,{error:'Invalid board item'});return true;}seen.add(item.key);
   if(mediaKeys.has(item.key)){const original=media.find(asset=>asset.key===item.key);clean.push({key:item.key,kind:original.kind,x:item.x,y:item.y,w:item.w,h:item.h});continue;}
   if(item.kind==='text'&&/^text:[A-Za-z0-9_-]{1,80}$/.test(item.key)&&typeof item.text==='string'&&item.text.length<=10000&&typeof (item.title||'')==='string'&&(item.title||'').length<=200){textCount++;if(textCount>80){json(400,{error:'Too many text blocks'});return true;}clean.push({key:item.key,kind:'text',title:item.title||'',text:item.text,x:item.x,y:item.y,w:item.w,h:item.h});continue;}
   json(400,{error:'Board item does not belong to this reference'});return true;
  }
  if(media.some(item=>!seen.has(item.key))){json(400,{error:'The board must keep all attached materials'});return true;}
  for(let i=0;i<clean.length;i++)for(let j=0;j<i;j++)if(overlaps(clean[i],clean[j])){json(400,{error:'Board items cannot overlap'});return true;}
  const now=Date.now();db.prepare('INSERT INTO reference_boards(user_id,reference_id,body,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,reference_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(uid,referenceId,JSON.stringify({items:clean}),now);
  json(200,{items,updatedAt:now});return true;
 };
}
