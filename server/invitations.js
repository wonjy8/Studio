import {randomUUID} from 'node:crypto';
import {token,digest,hashPassword} from './auth.js';
import {validPassword} from './password-policy.js';
import {isAdmin} from './site-roles.js';
export {isAdmin} from './site-roles.js';
export function invitationRoutes(db,origin){
 const authorize=session=>{if(!session)return {status:401,error:'Login required'};if(!isAdmin(db,session.user_id))return {status:403,error:'Administrator required'};if(!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,session.user_id,Date.now()))return {status:401,error:'Session changed. Sign in again'};if(db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(session.user_id))return {status:403,error:'Password change required'};return null;};
 let active=0;const attempts=[];
 return async({path,req,session,json,readJson})=>{
  if(path==='/api/signup'&&req.method==='POST'){
   if(session){json(409,{error:'ALREADY_SIGNED_IN'});return true;}
   const now=Date.now();while(attempts.length&&attempts[0]<now-900000)attempts.shift();
   if(active>=2||attempts.length>=30){json(429,{error:'RATE_LIMIT'});return true;}
   attempts.push(now);
   const data=await readJson(16384);
   if(!data||typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token)){json(400,{error:'INVITE_UNAVAILABLE'});return true;}
   const invite=db.prepare('SELECT id FROM invitations WHERE token_hash=? AND expires>? AND (max_uses IS NULL OR use_count<max_uses) AND revoked_at IS NULL').get(digest(data.token),now);
   if(!invite){json(400,{error:'INVITE_UNAVAILABLE'});return true;}
   if(typeof data.username!=='string'||!/^[a-zA-Z0-9_.-]{3,64}$/.test(data.username)){json(400,{error:'USERNAME_FORMAT'});return true;}
   if(data.name!==undefined&&(typeof data.name!=='string'||data.name.length>80||/[\u0000-\u001f\u007f]/.test(data.name))){json(400,{error:'NAME_FORMAT'});return true;}
   if(!validPassword(data.password)){json(400,{error:'PASSWORD_POLICY'});return true;}
   active++;
   let password;try{password=await hashPassword(data.password);}finally{active--;}
   db.exec('BEGIN IMMEDIATE');
   try{
    if(db.prepare('SELECT id FROM users WHERE lower(username)=lower(?)').get(data.username)){
     db.exec('ROLLBACK');json(409,{error:'USERNAME_TAKEN'});return true;
    }
    const changed=db.prepare('UPDATE invitations SET use_count=use_count+1, used_at=CASE WHEN max_uses IS NOT NULL AND use_count+1>=max_uses THEN ? ELSE NULL END WHERE id=? AND expires>? AND (max_uses IS NULL OR use_count<max_uses) AND revoked_at IS NULL').run(Date.now(),invite.id,Date.now());
    if(!changed.changes){db.exec('ROLLBACK');json(400,{error:'INVITE_UNAVAILABLE'});return true;}
    const userId=randomUUID();db.prepare('INSERT INTO users VALUES(?,?,?)').run(userId,data.username,password);
    if(data.name)db.prepare('INSERT INTO account_profiles VALUES(?,?)').run(userId,data.name.trim());
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   json(201,{ok:true});return true;
  }
  if(path==='/api/invitations'||/^\/api\/invitations\/[a-f0-9-]{36}$/.test(path)){
   const denied=authorize(session);if(denied){json(denied.status,{error:denied.error});return true;}
   if(path==='/api/invitations'&&req.method==='GET'){
    const invitations=db.prepare('SELECT id,created_at,expires,used_at,revoked_at,max_uses,use_count FROM invitations WHERE created_by=? ORDER BY created_at DESC LIMIT 50').all(session.user_id);
    json(200,{invitations});return true;
   }
   if(path==='/api/invitations'&&req.method==='POST'){
    const data=(!req.headers['content-length']&&!req.headers['transfer-encoding'])||req.headers['content-length']==='0'?{}:await readJson(16384);
    if(!data||typeof data!=='object'||Array.isArray(data)){json(400,{error:'INVITE_OPTIONS'});return true;}
    const hours=data.hours===undefined?48:data.hours,maxUses=data.maxUses===undefined?1:data.maxUses;
    if(![12,24,48].includes(hours)||(maxUses!==null&&(!Number.isSafeInteger(maxUses)||maxUses<1))){json(400,{error:'INVITE_OPTIONS'});return true;}
    db.exec('BEGIN IMMEDIATE');let result;
    try{
     const denied=authorize(session);if(denied){db.exec('ROLLBACK');json(denied.status,{error:denied.error});return true;}
     const now=Date.now();
     if(db.prepare('SELECT count(*) AS n FROM invitations WHERE expires>? AND (max_uses IS NULL OR use_count<max_uses) AND revoked_at IS NULL').get(now).n>=20){db.exec('ROLLBACK');json(429,{error:'INVITE_LIMIT'});return true;}
     const raw=token(),id=randomUUID(),expires=now+hours*3600000;
     db.prepare('INSERT INTO invitations(id,token_hash,created_by,created_at,expires,used_at,revoked_at,max_uses,use_count) VALUES(?,?,?,?,?,NULL,NULL,?,0)').run(id,digest(raw),session.user_id,now,expires,maxUses);
     result={id,url:`${origin}/#invite=${raw}`,expires,maxUses,useCount:0};db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    json(201,result);return true;
   }
   if(req.method==='DELETE'&&path!=='/api/invitations'){
    db.exec('BEGIN IMMEDIATE');let changed;
    try{const denied=authorize(session);if(denied){db.exec('ROLLBACK');json(denied.status,{error:denied.error});return true;}
     changed=db.prepare('UPDATE invitations SET revoked_at=? WHERE id=? AND created_by=? AND (max_uses IS NULL OR use_count<max_uses) AND revoked_at IS NULL').run(Date.now(),path.split('/').pop(),session.user_id);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    json(changed.changes?200:404,changed.changes?{ok:true}:{error:'Not found'});return true;
   }
   json(405,{error:'Method not allowed'});return true;
  }
  return false;
 };
}
