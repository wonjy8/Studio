import {flattenReferencePages,validateReferencePages,reconcileReferencePages,referencePageSelection} from '../src/domain/reference-pages.js';
import {migrateBoard,validateBoardLayout} from '../src/domain/reference-board-layout.js';
const columnCount=12;
const isSafePosition=item=>Number.isInteger(item.x)&&item.x>=0&&item.x<columnCount&&Number.isInteger(item.y)&&item.y>=0&&item.y<=500&&Number.isInteger(item.w)&&item.w>=2&&item.w<=columnCount&&item.x+item.w<=columnCount&&Number.isInteger(item.h)&&item.h>=2&&item.h<=12;
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const fileIdFromUrl=value=>value.match(/^\/api\/files\/([a-f0-9-]{36})$/)?.[1]||'';
const validLink=value=>{try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
export function referenceBoardRoutes(db,{initialize=true}={}){if(initialize){
 db.exec('CREATE TABLE IF NOT EXISTS reference_boards(user_id TEXT NOT NULL REFERENCES users(id),reference_id TEXT NOT NULL,body TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,reference_id))');
 }return async({path,req,session,json,readJson})=>{
  const match=path.match(/^\/api\/reference-boards\/([A-Za-z0-9_-]{1,80})$/);if(!match)return false;
  if(!session){json(401,{error:'Login required'});return true;}
  const uid=session.user_id,referenceId=match[1],row=db.prepare('SELECT body,revision FROM reference_library WHERE id=? AND user_id=?').get(referenceId,uid);
  if(!row){db.prepare('DELETE FROM reference_boards WHERE user_id=? AND reference_id=?').run(uid,referenceId);json(404,{error:'Reference not found'});return true;}
  const reference=JSON.parse(row.body),media=[];
  for(const url of reference.images||[]){const fileId=fileIdFromUrl(url);if(fileId)media.push({key:'image:'+url,kind:'image',imageUrl:url,fileId,...(db.prepare('SELECT name,type FROM files WHERE id=? AND user_id=?').get(fileId,uid)||{})});}
  for(const fileId of reference.files||[]){const file=db.prepare('SELECT name,type FROM files WHERE id=? AND user_id=?').get(fileId,uid);if(file)media.push({key:'file:'+fileId,kind:'file',fileId,...file});}
  if(reference.url&&validLink(reference.url))media.push({key:'link',kind:'link',url:reference.url,title:reference.name});
  const stored=db.prepare('SELECT body,updated_at FROM reference_boards WHERE user_id=? AND reference_id=?').get(uid,referenceId);
  let saved=[],savedLayout,savedPages,savedPageId;try{const body=stored?JSON.parse(stored.body):{};saved=body.items||[];savedLayout=body.layout;savedPages=body.pages;savedPageId=body.selectedPageId;}catch{}
  const byKey=new Map(saved.filter(item=>item&&typeof item.key==='string').map(item=>[item.key,item]));
  const items=media.map((item,index)=>{const prior=byKey.get(item.key)||{},fallback={x:(index%3)*4,y:Math.floor(index/3)*5,w:4,h:4};return {...item,...fallback,...(isSafePosition(prior)?{x:prior.x,y:prior.y,w:prior.w,h:prior.h}:{})};});
  for(const item of saved){if(item?.kind==='text'&&/^text:[A-Za-z0-9_-]{1,80}$/.test(item.key||'')&&typeof item.text==='string'&&item.text.length<=10000&&typeof (item.title||'')==='string'&&(item.title||'').length<=200)items.push({key:item.key,kind:'text',title:item.title||'',text:item.text,...(isSafePosition(item)?{x:item.x,y:item.y,w:item.w,h:item.h}:{x:0,y:Math.min(500,items.length*5),w:4,h:4})});}
  for(const item of saved)if(item?.kind==='link'&&/^link:[A-Za-z0-9_-]{1,80}$/.test(item.key||'')&&typeof item.url==='string'&&item.url.length<=2000&&validLink(item.url)&&typeof (item.title||'')==='string'&&(item.title||'').length<=200)items.push({...item,...(isSafePosition(item)?{}:{x:0,y:Math.min(500,items.length*5),w:4,h:4})});
  const occupied=[];let validLayout=true;for(const item of items){if(!isSafePosition(item)||occupied.some(other=>overlaps(item,other))){validLayout=false;break;}occupied.push(item);}
  if(!validLayout&&!savedLayout){const clean=items.map((item,index)=>({...item,x:(index%3)*4,y:Math.floor(index/3)*5,w:4,h:4}));items.splice(0,items.length,...clean);}
  let layout;try{layout=validateBoardLayout(migrateBoard(items,savedLayout),items.map(item=>item.key));}catch{layout=migrateBoard(items);}
  let pages;try{pages=savedPages?validateReferencePages(savedPages,items):reconcileReferencePages(items,layout);}catch{pages=reconcileReferencePages(items,layout,savedPages);}layout=flattenReferencePages(pages);const selectedPageId=pages.some(page=>page.id===savedPageId)?savedPageId:pages[0].id;
  if(req.method==='GET'){json(200,{items,layout,pages,selectedPageId,updatedAt:stored?.updated_at||null});return true;}
  if(req.method!=='PUT'){json(405,{error:'Method not allowed'});return true;}
  const data=await readJson(1024*1024);if(!Array.isArray(data?.items)||data.items.length>150){json(400,{error:'Invalid board'});return true;}
  const currentStored=db.prepare('SELECT updated_at FROM reference_boards WHERE user_id=? AND reference_id=?').get(uid,referenceId),currentReference=db.prepare('SELECT revision FROM reference_library WHERE id=? AND user_id=?').get(referenceId,uid);
  if(!currentReference||currentReference.revision!==row.revision||(currentStored?.updated_at||null)!==(stored?.updated_at||null)){json(409,{error:'레퍼런스가 변경되었습니다. 다시 열어 주세요.'});return true;}
  if((data.layout||savedLayout)&&(data.updatedAt!== (stored?.updated_at||null))){json(409,{error:'보드가 변경되었습니다. 다시 열어 최신 배치를 확인하세요.'});return true;}
  const mediaKeys=new Set(media.map(item=>item.key)),seen=new Set(),clean=[];let textCount=0;
  for(const item of data.items){
   if(!item||typeof item!=='object'||typeof item.key!=='string'||seen.has(item.key)||!isSafePosition(item)){json(400,{error:'Invalid board item'});return true;}seen.add(item.key);
   if(mediaKeys.has(item.key)){const original=media.find(asset=>asset.key===item.key);clean.push({key:item.key,kind:original.kind,x:item.x,y:item.y,w:item.w,h:item.h});continue;}
   if(item.kind==='text'&&/^text:[A-Za-z0-9_-]{1,80}$/.test(item.key)&&typeof item.text==='string'&&item.text.length<=10000&&typeof (item.title||'')==='string'&&(item.title||'').length<=200){textCount++;if(textCount>80){json(400,{error:'Too many text blocks'});return true;}clean.push({key:item.key,kind:'text',title:item.title||'',text:item.text,x:item.x,y:item.y,w:item.w,h:item.h});continue;}
   if(item.kind==='link'&&/^link:[A-Za-z0-9_-]{1,80}$/.test(item.key)&&typeof item.url==='string'&&item.url.length<=2000&&validLink(item.url)&&typeof (item.title||'')==='string'&&(item.title||'').length<=200){textCount++;if(textCount>80){json(400,{error:'Too many content items'});return true;}clean.push({key:item.key,kind:'link',url:item.url,title:item.title||'',x:item.x,y:item.y,w:item.w,h:item.h});continue;}
   json(400,{error:'Board item does not belong to this reference'});return true;
  }
  if(media.some(item=>!seen.has(item.key))){json(400,{error:'The board must keep all attached materials'});return true;}
  if(!data.layout)for(let i=0;i<clean.length;i++)for(let j=0;j<i;j++)if(overlaps(clean[i],clean[j])){json(400,{error:'Board items cannot overlap'});return true;}
  let nextLayout;try{nextLayout=validateBoardLayout(data.layout||savedLayout||migrateBoard(clean),clean.map(item=>item.key));}catch(error){json(400,{error:error.message});return true;}
  let nextPages,nextPageId;try{if(data.pages!==undefined){nextPages=validateReferencePages(data.pages,clean);const flattened=validateBoardLayout(flattenReferencePages(nextPages),clean.map(item=>item.key));if(data.layout&&JSON.stringify(nextLayout)!==JSON.stringify(flattened))throw Error('페이지 배치와 전체 배치가 일치하지 않습니다.');nextLayout=flattened;}else{nextPages=reconcileReferencePages(clean,nextLayout,pages);nextLayout=flattenReferencePages(nextPages);}nextPageId=referencePageSelection(nextPages,data.selectedPageId===undefined?selectedPageId:data.selectedPageId);}catch(error){json(400,{error:error.message});return true;}
  const now=Math.max(Date.now(),(stored?.updated_at||0)+1);db.prepare('INSERT INTO reference_boards(user_id,reference_id,body,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,reference_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at').run(uid,referenceId,JSON.stringify({items:clean,layout:nextLayout,pages:nextPages,selectedPageId:nextPageId}),now);
  const savedByKey=new Map(clean.map(item=>[item.key,item]));const resultItems=[...media.map(asset=>({...asset,...savedByKey.get(asset.key)})),...clean.filter(item=>item.kind==='text'||item.kind==='link'&&item.key!=='link')];json(200,{items:resultItems,layout:nextLayout,pages:nextPages,selectedPageId:nextPageId,updatedAt:now});return true;
 };
}
