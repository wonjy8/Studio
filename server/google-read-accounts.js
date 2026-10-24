import {createHash,randomUUID} from 'node:crypto';
const primaryId=(uid,service,subject)=>'legacy-'+createHash('sha256').update(JSON.stringify([uid,service,subject])).digest('base64url');
export function googleReadAccounts(db){
 db.exec(`CREATE TABLE IF NOT EXISTS google_read_additional_accounts(account_id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,service TEXT NOT NULL,subject TEXT NOT NULL,email TEXT NOT NULL,credentials TEXT NOT NULL,generation TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,UNIQUE(user_id,service,subject));
 CREATE TABLE IF NOT EXISTS google_read_account_states(state_hash TEXT PRIMARY KEY REFERENCES google_read_states(state_hash) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,mode TEXT NOT NULL,account_id TEXT,account_generation TEXT,revocation_version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS google_read_account_epochs(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,service TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(user_id,service));
 CREATE TABLE IF NOT EXISTS google_read_account_revocations(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,service TEXT NOT NULL,subject TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(user_id,service,subject));`);

 const primary=(uid,service)=>{const row=db.prepare('SELECT * FROM google_read_accounts WHERE user_id=? AND service=?').get(uid,service);return row?{...row,account_id:primaryId(uid,service,row.subject),primary:true,created_at:null}:undefined;};
 const all=(uid,service)=>{const row=primary(uid,service);return [...(row?[row]:[]),...db.prepare('SELECT * FROM google_read_additional_accounts WHERE user_id=? AND service=? ORDER BY created_at,account_id').all(uid,service).map(a=>({...a,primary:false}))];};
 const find=(uid,service,id)=>id?all(uid,service).find(a=>a.account_id===id):primary(uid,service);
 const version=(uid,service)=>db.prepare('SELECT version FROM google_read_account_epochs WHERE user_id=? AND service=?').get(uid,service)?.version||0;
 const revokedSince=(uid,service,subject,start)=>Number(db.prepare('SELECT version FROM google_read_account_revocations WHERE user_id=? AND service=? AND subject=?').get(uid,service,subject)?.version||0)>start;
 function put(uid,service,profile,credentials,old,{mode='reconnect',startedVersion=0,createPrimary=true}={}){
  const reject=(message,reason='stale')=>{throw Object.assign(Error(message),{status:409,reason});};
  db.exec('BEGIN IMMEDIATE');try{
   if(revokedSince(uid,service,profile.sub,startedVersion))reject('연결 요청 후 이 계정이 해제되었습니다.');
   const rows=all(uid,service),current=old&&rows.find(a=>a.account_id===old.account_id);
   if(old&&(!current||current.generation!==old.generation||current.subject!==profile.sub))reject('연결 요청 후 계정이 변경되었습니다.');
   if(!old&&rows.some(a=>a.subject===profile.sub))reject('계정이 다른 연결 요청에서 변경되었습니다.');
   if(!old&&mode!=='add'&&rows.length)reject('기존 기본 계정을 유지합니다. 다른 계정은 추가로 연결하세요.','account');
   if(!old&&rows.length>=10)reject('서비스당 계정은 최대 10개입니다.','limit');
   const generation=randomUUID();let result;
   if(old?.primary||!rows.length&&createPrimary){db.prepare("INSERT INTO google_read_accounts VALUES(?,?,?,?,?,?, '') ON CONFLICT(user_id,service) DO UPDATE SET subject=excluded.subject,email=excluded.email,credentials=excluded.credentials,generation=excluded.generation,error=''").run(uid,service,profile.sub,profile.email,credentials,generation);result=primary(uid,service);}
   else{const id=old?.account_id||randomUUID();db.prepare("INSERT INTO google_read_additional_accounts(account_id,user_id,service,subject,email,credentials,generation,error,created_at) VALUES(?,?,?,?,?,?,?,'',?) ON CONFLICT(user_id,service,subject) DO UPDATE SET email=excluded.email,credentials=excluded.credentials,generation=excluded.generation,error=''").run(id,uid,service,profile.sub,profile.email,credentials,generation,Date.now());result=all(uid,service).find(a=>a.subject===profile.sub);}
   db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function remove(row){db.exec('BEGIN IMMEDIATE');try{const current=find(row.user_id,row.service,row.account_id);if(!current||current.generation!==row.generation)throw Object.assign(Error('연결이 변경되었습니다. 상태를 다시 확인하세요.'),{status:409,reason:'stale'});const next=version(row.user_id,row.service)+1;db.prepare('INSERT INTO google_read_account_epochs VALUES(?,?,?) ON CONFLICT(user_id,service) DO UPDATE SET version=excluded.version').run(row.user_id,row.service,next);db.prepare('INSERT INTO google_read_account_revocations VALUES(?,?,?,?) ON CONFLICT(user_id,service,subject) DO UPDATE SET version=excluded.version').run(row.user_id,row.service,row.subject,next);db.prepare('DELETE FROM google_read_states WHERE user_id=? AND service=? AND state_hash IN (SELECT state_hash FROM google_read_account_states WHERE account_id=?)').run(row.user_id,row.service,row.account_id);if(row.primary)db.prepare('DELETE FROM google_read_accounts WHERE user_id=? AND service=? AND generation=?').run(row.user_id,row.service,row.generation);else db.prepare('DELETE FROM google_read_additional_accounts WHERE user_id=? AND service=? AND account_id=? AND generation=?').run(row.user_id,row.service,row.account_id,row.generation);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
 function update(row,field,value){if(!['credentials','error'].includes(field))throw Error('Invalid account field');const table=row.primary?'google_read_accounts':'google_read_additional_accounts';db.prepare('UPDATE '+table+' SET '+field+'=? WHERE user_id=? AND service=? AND generation=?'+(row.primary?'':' AND account_id=?')).run(value,row.user_id,row.service,row.generation,...(row.primary?[]:[row.account_id]));}
 return {primary,all,find,version,revokedSince,put,remove,update};
}
