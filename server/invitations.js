import {randomUUID} from 'node:crypto';
import {token,digest,hashPassword} from './auth.js';
import {validPassword} from './password-policy.js';
export function isAdmin(db,id){return Boolean(id&&db.prepare("SELECT value FROM site_settings WHERE key='admin_user_id'").get()?.value===id);}
export function invitationRoutes(db,origin){
 let active=0;const attempts=[];
 return async({path,req,session,json,readJson})=>{
  if(path==='/api/signup'&&req.method==='POST'){
   if(session){json(409,{error:'ALREADY_SIGNED_IN'});return true;}
   const now=Date.now();while(attempts.length&&attempts[0]<now-900000)attempts.shift();
   if(active>=2||attempts.length>=30){json(429,{error:'RATE_LIMIT'});return true;}
   attempts.push(now);
   const data=await readJson(16384);
   if(!data||typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token)){json(400,{error:'INVITE_UNAVAILABLE'});return true;}
   const invite=db.prepare('SELECT id FROM invitations WHERE token_hash=? AND expires>? AND used_at IS NULL AND revoked_at IS NULL').get(digest(data.token),now);
   if(!invite){json(400,{error:'INVITE_UNAVAILABLE'});return true;}
   if(typeof data.username!=='string'||!/^[a-zA-Z0-9_.-]{3,64}$/.test(data.username)){json(400,{error:'USERNAME_FORMAT'});return true;}
   if(!validPassword(data.password)){json(400,{error:'PASSWORD_POLICY'});return true;}
   active++;
   let password;try{password=await hashPassword(data.password);}finally{active--;}
   db.exec('BEGIN IMMEDIATE');
   try{
    if(db.prepare('SELECT id FROM users WHERE lower(username)=lower(?)').get(data.username)){
     db.exec('ROLLBACK');json(409,{error:'USERNAME_TAKEN'});return true;
    }
    const changed=db.prepare('UPDATE invitations SET used_at=? WHERE id=? AND expires>? AND used_at IS NULL AND revoked_at IS NULL').run(Date.now(),invite.id,Date.now());
    if(!changed.changes){db.exec('ROLLBACK');json(400,{error:'INVITE_UNAVAILABLE'});return true;}
    db.prepare('INSERT INTO users VALUES(?,?,?)').run(randomUUID(),data.username,password);
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   json(201,{ok:true});return true;
  }
  if(path==='/api/invitations'||/^\/api\/invitations\/[a-f0-9-]{36}$/.test(path)){
   if(!session){json(401,{error:'Login required'});return true;}
   if(!isAdmin(db,session.user_id)){json(403,{error:'Administrator required'});return true;}
   if(path==='/api/invitations'&&req.method==='GET'){
    const invitations=db.prepare('SELECT id,created_at,expires,used_at,revoked_at FROM invitations WHERE created_by=? ORDER BY created_at DESC LIMIT 50').all(session.user_id);
    json(200,{invitations});return true;
   }
   if(path==='/api/invitations'&&req.method==='POST'){
    const now=Date.now();
    if(db.prepare('SELECT count(*) AS n FROM invitations WHERE expires>? AND used_at IS NULL AND revoked_at IS NULL').get(now).n>=20){json(429,{error:'INVITE_LIMIT'});return true;}
    const raw=token(),id=randomUUID(),expires=now+48*3600000;
    db.prepare('INSERT INTO invitations VALUES(?,?,?,?,?,NULL,NULL)').run(id,digest(raw),session.user_id,now,expires);
    json(201,{id,url:`${origin}/#invite=${raw}`,expires});return true;
   }
   if(req.method==='DELETE'&&path!=='/api/invitations'){
    const changed=db.prepare('UPDATE invitations SET revoked_at=? WHERE id=? AND created_by=? AND used_at IS NULL AND revoked_at IS NULL').run(Date.now(),path.split('/').pop(),session.user_id);
    json(changed.changes?200:404,changed.changes?{ok:true}:{error:'Not found'});return true;
   }
   json(405,{error:'Method not allowed'});return true;
  }
  return false;
 };
}
