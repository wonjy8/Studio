import {randomUUID} from 'node:crypto';
import {setRequirementArea} from '../src/domain/school-requirement-area.js';
import {stampSchoolDocuments} from '../src/domain/school-course-page.js';
import {emptySchool,validSchool} from '../src/domain/school.js';
// A separate account-owned store never enters shared project snapshots or legacy APIs.
export function schoolRoutes(db){
 db.exec('CREATE TABLE IF NOT EXISTS school_files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,type TEXT NOT NULL,bytes BLOB NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS school_workspaces(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,revision INTEGER NOT NULL)');
 return async({path,req,session,json,readJson})=>{if(!['/api/school','/api/school/graduation-areas'].includes(path))return false;if(!session){json(401,{error:'Login required'});return true;}const uid=session.user_id,read=()=>{const row=db.prepare('SELECT body,revision FROM school_workspaces WHERE user_id=?').get(uid);return {school:row?JSON.parse(row.body):emptySchool(),revision:row?.revision||0};};
 if(path==='/api/school/graduation-areas'){
  if(req.method!=='POST'){json(405,{error:'Method not allowed'});return true;}
  const data=await readJson(4096);if(!data||!Number.isSafeInteger(data.revision)||data.revision<0){json(400,{error:'학교 변경 버전을 확인하세요.'});return true;}
  const current=read(),next=structuredClone(current.school),{revision,...input}=data;try{setRequirementArea(next,input,'area-'+randomUUID());if(!validSchool(next))throw Error('필요 학점 정보를 확인하세요.');}catch(error){json(400,{error:error.message});return true;}
  if(revision!==current.revision){json(409,{error:'학교 정보가 다른 화면에서 변경되었습니다. 입력을 보관한 뒤 새로고침하세요.'});return true;}
  const body=JSON.stringify(next),changed=current.revision===0?db.prepare('INSERT INTO school_workspaces VALUES(?,?,1) ON CONFLICT(user_id) DO NOTHING').run(uid,body):db.prepare('UPDATE school_workspaces SET body=?,revision=revision+1 WHERE user_id=? AND revision=?').run(body,uid,revision);if(!changed.changes){json(409,{error:'학교 정보가 변경되었습니다.'});return true;}json(200,{school:next,revision:revision+1});return true;
 }
 if(req.method==='GET'){json(200,read());return true;}
 if(req.method==='PUT'){const data=await readJson(8*1024*1024);if(!data||Object.keys(data).some(k=>!['school','revision'].includes(k))||!Number.isSafeInteger(data.revision)||data.revision<0||!validSchool(data.school)){json(400,{error:'학기·강의·학점 정보를 확인하세요.'});return true;}const current=read();stampSchoolDocuments(data.school,current.school);const body=JSON.stringify(data.school);if(body===JSON.stringify(current.school)){json(200,current);return true;}if(data.revision!==current.revision){json(409,{error:'학교 정보가 다른 화면에서 변경되었습니다. 입력을 보관한 뒤 새로고침하세요.'});return true;}const changed=current.revision===0?db.prepare('INSERT INTO school_workspaces VALUES(?,?,1) ON CONFLICT(user_id) DO NOTHING').run(uid,body):db.prepare('UPDATE school_workspaces SET body=?,revision=revision+1 WHERE user_id=? AND revision=?').run(body,uid,data.revision);if(!changed.changes){json(409,{error:'학교 정보가 변경되었습니다.'});return true;}json(200,{school:data.school,revision:current.revision+1});return true;}
 json(405,{error:'Method not allowed'});return true;};
}
