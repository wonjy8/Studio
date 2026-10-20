import {randomBytes,createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const services={calendar:'/oauth/google/calendar/callback',tasks:'/oauth/google/tasks/callback',sheets:'/oauth/google/callback'};
// A narrowly scoped, one-use return proof carries no login token. The normal
// session cookie remains Strict; the original session must still be live.
export function googleOAuthReturn(db,{secure}){
 db.exec('CREATE TABLE IF NOT EXISTS google_oauth_returns(state_hash TEXT PRIMARY KEY,service TEXT NOT NULL,session_token TEXT NOT NULL,proof_hash TEXT NOT NULL,expires INTEGER NOT NULL)');
 const cookie=(service,value,age)=>`studio_google_${service}_return=${value}; Path=${services[service]}; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
 return {
  start(path,result,session,res){const service=({'/api/google/calendar/connect':'calendar','/api/google/tasks/connect':'tasks','/api/google/connect':'sheets'})[path];if(!service||!session||typeof result?.url!=='string')return;const url=new URL(result.url),state=url.searchParams.get('state');if(!state)return;const proof=randomBytes(32).toString('base64url');db.prepare('DELETE FROM google_oauth_returns WHERE expires<=? OR (service=? AND session_token=?)').run(Date.now(),service,session.token);db.prepare('INSERT INTO google_oauth_returns VALUES(?,?,?,?,?)').run(hash(state),service,session.token,hash(proof),Date.now()+600000);res.setHeader('Set-Cookie',cookie(service,proof,600));},
  recover(path,url,req,res){const service=Object.keys(services).find(key=>services[key]===path);if(!service||req.method!=='GET')return;const state=url.searchParams.get('state')||'',proof=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`studio_google_${service}_return=`))?.split('=')[1];res.setHeader('Set-Cookie',cookie(service,'',0));if(!proof)return;const row=db.prepare('SELECT * FROM google_oauth_returns WHERE state_hash=? AND service=? AND proof_hash=? AND expires>?').get(hash(state),service,hash(proof),Date.now());if(!row)return;db.prepare('DELETE FROM google_oauth_returns WHERE state_hash=?').run(hash(state));return db.prepare('SELECT user_id,token FROM sessions WHERE token=? AND expires>?').get(row.session_token,Date.now());}
 };
}
