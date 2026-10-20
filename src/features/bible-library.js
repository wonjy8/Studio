import {request} from '../integrations/api.js';
import {parseBiblePassages,verseInPassage} from '../domain/bible.js';

// Only Bible source text is persisted. Notes, annotations and QT records always
// use their authenticated APIs. Every local record is partitioned by account.
const accounts=new Map();
let database;
function openDatabase(){
 if(!globalThis.indexedDB)return Promise.resolve(null);
 if(!database)database=new Promise(resolve=>{
  const timer=setTimeout(()=>resolve(null),400),opening=indexedDB.open('studio-bibles',1);
  opening.onupgradeneeded=()=>{for(const name of ['catalogs','translations'])if(!opening.result.objectStoreNames.contains(name))opening.result.createObjectStore(name);};
  opening.onsuccess=()=>{clearTimeout(timer);resolve(opening.result);};opening.onerror=opening.onblocked=()=>{clearTimeout(timer);resolve(null);};
 });return database;
}
async function disk(store,key,value){
 try{const db=await openDatabase();if(!db)return null;return await new Promise(resolve=>{const tx=db.transaction(store,value===undefined?'readonly':'readwrite'),table=tx.objectStore(store),operation=value===undefined?table.get(key):value===null?table.delete(key):table.put(value,key);let result=null;operation.onsuccess=()=>{result=operation.result??null;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>resolve(null);});}catch{return null;}
}
const stamp=value=>value?.id+':'+(value?.revision||value?.importedAt);
export function createBibleLibrary(account,{fetcher=request}={}){
 if(!accounts.has(account))accounts.set(account,{catalog:null,translations:new Map(),loading:new Map(),chapters:new Map(),pending:new Map(),downloads:new Map()});
 const memory=accounts.get(account);let refreshed=false,refreshTask=null;
 const key=id=>JSON.stringify([account,id]);
 async function catalog(){if(!memory.catalog)memory.catalog=await disk('catalogs',account);return memory.catalog;}
 async function accept(result){
  const previous=memory.catalog,metadata={versions:result.versions,repository:result.repository||{},defaultId:result.versions[0]?.id||''};
  if(previous?.versions.some(old=>{const incoming=metadata.versions.find(v=>v.id===old.id);return incoming&&incoming.importedAt<old.importedAt;}))return;
  memory.catalog=metadata;void disk('catalogs',account,metadata);
  if(previous)for(const version of previous.versions){const next=metadata.versions.find(v=>v.id===version.id);if(stamp(next)!==stamp(version)){memory.translations.delete(version.id);memory.chapters.clear();void disk('translations',key(version.id),null);}}
 }
 async function translation(id){
  let value=memory.translations.get(id);if(!value){if(!memory.loading.has(id))memory.loading.set(id,disk('translations',key(id)).finally(()=>memory.loading.delete(id)));value=await memory.loading.get(id);if(value)memory.translations.set(id,value);}
  const current=memory.catalog?.versions.find(v=>v.id===id);return value&&stamp(value.bible)===stamp(current)?value:null;
 }
 function download(id){
  if(memory.downloads.has(id))return memory.downloads.get(id);
  const task=(async()=>{if(await translation(id))return;const data=await fetcher('scripture/bible?'+new URLSearchParams({version:id,download:'1'}));
   // A late download must not restore a removed or superseded translation.
   const current=memory.catalog?.versions.find(v=>v.id===id);if(!current||stamp(current)!==stamp(data.bible))return;
   const value={bible:data.bible,books:data.books,verses:data.verses};memory.translations.set(id,value);await disk('translations',key(id),value);
  })().catch(()=>{}).finally(()=>memory.downloads.delete(id));memory.downloads.set(id,task);return task;
 }
 function warm(id){if(id)void download(id);const other=memory.catalog?.versions.find(v=>v.id!==id);if(other)void download(other.id);}
 function refresh(){
  if(refreshed)return refreshTask;refreshed=true;
  refreshTask=fetcher('scripture/bible?metadata=1').then(async data=>{await accept(data);warm(memory.catalog.defaultId);}).catch(()=>{});return refreshTask;
 }
 function local(data,params){
  const passages=parseBiblePassages(params.get('passage')||''),book=params.get('book'),chapter=Number(params.get('chapter')),q=params.get('q')?.trim().slice(0,200)||'';
  let verses=[];
  if(passages){const found=new Map();for(const passage of passages)for(const verse of data.verses)if(verseInPassage(verse,passage))found.set(JSON.stringify([verse.book,verse.chapter,verse.verse]),verse);if(found.size>500)throw Error('성경 본문은 한 번에 500절까지 선택하세요.');verses=[...found.values()];}
  else if(book&&chapter>0)verses=data.verses.filter(v=>v.book===book&&v.chapter===chapter);
  else if(q)verses=data.verses.filter(v=>v.text.includes(q)).slice(0,100);
  return {bible:data.bible,books:data.books,verses,versions:memory.catalog.versions,repository:memory.catalog.repository};
 }
 async function read(params){
  params=new URLSearchParams(params);params.sort();let metadata=await catalog();
  // A previously failed import may now be repaired; do not keep showing its old status.
  if(metadata?.repository?.error){await refresh();metadata=memory.catalog;}
  const id=params.get('version')||metadata?.defaultId;
  if(metadata){const data=await translation(id);if(data){refresh();warm(id);return local(data,params);}}
  const cacheKey=params.toString(),cached=memory.chapters.get(cacheKey);
  if(cached&&Date.now()-cached.time<60000){refresh();warm(cached.result.bible?.id);return structuredClone({...cached.result,versions:memory.catalog?.versions||cached.result.versions,repository:memory.catalog?.repository||cached.result.repository});}
  if(memory.pending.has(cacheKey))return memory.pending.get(cacheKey);
  const pending=fetcher('scripture/bible?'+params).then(async result=>{await accept(result);refreshed=true;if(!params.has('q')){const entry={result,time:Date.now()};memory.chapters.set(cacheKey,entry);if(result.bible?.id){const canonical=new URLSearchParams(params);canonical.set('version',result.bible.id);canonical.sort();memory.chapters.set(canonical.toString(),entry);}while(memory.chapters.size>24)memory.chapters.delete(memory.chapters.keys().next().value);}warm(result.bible?.id);return result;}).finally(()=>memory.pending.delete(cacheKey));
  memory.pending.set(cacheKey,pending);return pending;
 }
 return {read};
}
