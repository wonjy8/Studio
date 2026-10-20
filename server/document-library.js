import {validDocuments} from '../src/domain/documents.js';
import {registerNewAccountDocuments} from './material-library.js';
// Account documents are independent of the currently selected project.
export function documentLibraryRoutes(db){
 db.exec('CREATE TABLE IF NOT EXISTS document_library(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,revision INTEGER NOT NULL)');
 return async({path,req,session,json,readJson})=>{
  if(path!=='/api/document-library')return false;
  if(!session){json(401,{error:'Login required'});return true;}
  const uid=session.user_id,read=()=>{const row=db.prepare('SELECT body,revision FROM document_library WHERE user_id=?').get(uid);return {documents:row?JSON.parse(row.body):[],revision:row?.revision||0};};
  if(req.method==='GET'){json(200,read());return true;}
  if(req.method==='PUT'){
   const data=await readJson(8*1024*1024);
   if(!data||Object.keys(data).some(k=>!['documents','revision'].includes(k))||!Number.isSafeInteger(data.revision)||data.revision<0||!validDocuments(data.documents)){json(400,{error:'Invalid documents'});return true;}
   const current=read(),body=JSON.stringify(data.documents);
   // A response-loss retry is safe only when the submitted complete value matches.
   if(body===JSON.stringify(current.documents)){json(200,current);return true;}
   if(data.revision!==current.revision){json(409,{error:'Documents changed. Reload before editing.'});return true;}
   const changed=current.revision===0?db.prepare('INSERT INTO document_library VALUES(?,?,1) ON CONFLICT(user_id) DO NOTHING').run(uid,body):db.prepare('UPDATE document_library SET body=?,revision=revision+1 WHERE user_id=? AND revision=?').run(body,uid,data.revision);
   if(!changed.changes){json(409,{error:'Documents changed. Reload before editing.'});return true;}
   registerNewAccountDocuments(db,uid,current.documents,data.documents);json(200,{documents:data.documents,revision:current.revision+1});return true;
  }
  json(405,{error:'Method not allowed'});return true;
 };
}
