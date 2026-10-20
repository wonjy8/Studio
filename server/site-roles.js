// Site authority is separate from organization membership and equipment custody.
// Existing installations require a privately verified immutable highest ID. Only
// a new installation explicitly marked eligible may claim its first successful
// login once. Missing provisioning retains bounded legacy administration.
import {randomUUID} from 'node:crypto';
export const siteRoleTables=['site_role_memberships','site_role_audit'];
export const siteRoleSchema=`
CREATE TABLE IF NOT EXISTS site_role_memberships(user_id TEXT PRIMARY KEY REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('admin','user')),revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS site_role_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),target_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,reason TEXT NOT NULL,revision INTEGER NOT NULL,actor_role TEXT NOT NULL,created_at INTEGER NOT NULL);`;
const managementEnabled=new WeakMap();
export const siteRoleManagementEnabled=db=>managementEnabled.get(db)===true;
export function configureSiteRoleManagement(db,enabled){managementEnabled.set(db,enabled===true);}
export function setupSiteRoles(db){db.exec(siteRoleSchema);}
// Login calls this after credential/status revalidation under BEGIN IMMEDIATE.
// The savepoint keeps the three markers atomic even when called independently.
export function claimFirstSiteAdministrator(db,uid){
 if(!active(db,uid))return false;
 // A successful login while disabled still consumes fresh-install eligibility.
 // Enabling later cannot promote a different, later login. No role table access.
 if(managementEnabled.get(db)!==true){db.prepare("UPDATE site_settings SET value='held' WHERE key='site_role_bootstrap_state' AND value='eligible'").run();return false;}
 if(!hasTable(db,'site_role_memberships')||!hasTable(db,'site_role_audit')){db.prepare("UPDATE site_settings SET value='held' WHERE key='site_role_bootstrap_state' AND value='eligible'").run();return false;}
 db.exec('SAVEPOINT site_role_first_login_claim');
 try{
  if(setting(db,'site_role_bootstrap_state')!=='eligible'){db.exec('RELEASE site_role_first_login_claim');return false;}
  if(db.prepare("SELECT key FROM site_settings WHERE key IN ('super_admin_user_id','site_role_first_login_user_id') LIMIT 1").get()){
   db.prepare("UPDATE site_settings SET value='blocked' WHERE key='site_role_bootstrap_state'").run();db.exec('RELEASE site_role_first_login_claim');return false;
  }
  db.prepare("INSERT INTO site_settings(key,value) VALUES('super_admin_user_id',?),('site_role_first_login_user_id',?)").run(uid,uid);
  db.prepare("UPDATE site_settings SET value='claimed' WHERE key='site_role_bootstrap_state'").run();
  db.prepare('INSERT INTO site_role_audit(id,actor_id,target_id,action,reason,revision,actor_role,created_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),uid,uid,'bootstrap-highest','First successful login on an eligible new installation',1,'super_admin',Date.now());
  db.exec('RELEASE site_role_first_login_claim');return true;
 }catch(error){db.exec('ROLLBACK TO site_role_first_login_claim');db.exec('RELEASE site_role_first_login_claim');throw error;}
}
const hasTable=(db,name)=>Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
const setting=(db,key)=>db.prepare('SELECT value FROM site_settings WHERE key=?').get(key)?.value||null;
function active(db,uid){if(!uid||!db.prepare('SELECT id FROM users WHERE id=?').get(uid))return false;if(!hasTable(db,'account_status'))return true;const state=db.prepare('SELECT suspended_until,deleted_at FROM account_status WHERE user_id=?').get(uid);return !state||(state.deleted_at==null&&(!state.suspended_until||state.suspended_until<=Date.now()));}
function membership(db,uid){return hasTable(db,'site_role_memberships')?db.prepare('SELECT role,revision FROM site_role_memberships WHERE user_id=?').get(uid):null;}
function provisioned(db){const id=setting(db,'super_admin_user_id');return Boolean(managementEnabled.get(db)===true&&hasTable(db,'site_role_memberships')&&hasTable(db,'site_role_audit')&&id&&active(db,id));}
export function siteRole(db,uid){if(!active(db,uid))return 'user';const highest=setting(db,'super_admin_user_id');if(managementEnabled.get(db)!==true||!hasTable(db,'site_role_memberships')||!hasTable(db,'site_role_audit')||!highest)return setting(db,'admin_user_id')===uid?'admin':'user';if(!provisioned(db))return 'user';if(uid===highest)return 'super_admin';return membership(db,uid)?.role==='admin'?'admin':'user';}
export const isAdmin=(db,uid)=>['super_admin','admin'].includes(siteRole(db,uid));
export const isSuperAdmin=(db,uid)=>siteRole(db,uid)==='super_admin';
// Protection also applies to disabled accounts and historical legacy admins.
export function isProtectedSiteAccount(db,uid){return Boolean(uid&&(setting(db,'super_admin_user_id')===uid||setting(db,'admin_user_id')===uid||membership(db,uid)?.role==='admin'));}
export function siteCapabilities(db,uid){const role=siteRole(db,uid),enabled=provisioned(db);return {siteRole:role,isAdmin:['super_admin','admin'].includes(role),isSuperAdmin:role==='super_admin',canManageProjects:enabled&&['super_admin','admin'].includes(role),canDeleteAccounts:enabled&&['super_admin','admin'].includes(role),canManageSiteRoles:role==='super_admin'};}
const failure=(status,message)=>Object.assign(Error(message),{status});
function assertLiveSuper(db,session){const uid=session?.user_id;if(!isSuperAdmin(db,uid))throw failure(403,'Highest administrator required');if(!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,uid,Date.now()))throw failure(401,'Session changed. Sign in again');if(hasTable(db,'password_changes')&&db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(uid))throw failure(403,'Password change required');}
export function siteRoleRoutes(db){return async({path,req,session,json,readJson})=>{
 if(!path.startsWith('/api/admin/site-roles'))return false;
 if(!session){json(401,{error:'Login required'});return true;}
 try{
  assertLiveSuper(db,session);
  if(path==='/api/admin/site-roles'&&req.method==='GET'){
   const accounts=db.prepare('SELECT id,username FROM users ORDER BY username,id').all().map(user=>({...user,role:siteRole(db,user.id),revision:membership(db,user.id)?.revision||0,protected:isProtectedSiteAccount(db,user.id),available:active(db,user.id)}));
   json(200,{configured:true,canManage:true,accounts});return true;
  }
  const route=path.match(/^\/api\/admin\/site-roles\/([A-Za-z0-9_-]{1,100})$/);
  if(!route||req.method!=='PUT'){json(404,{error:'Not found'});return true;}
  const data=await readJson(16384);
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!['role','revision','confirmUsername','reason'].includes(key))||!['admin','user'].includes(data.role)||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.confirmUsername!=='string'||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>500||/[\u0000-\u001f\u007f]/.test(data.reason))throw failure(400,'Role, revision, confirmation and reason required');
  db.exec('BEGIN IMMEDIATE');let result;
  try{
   assertLiveSuper(db,session);const uid=route[1],target=db.prepare('SELECT id,username FROM users WHERE id=?').get(uid);
   if(!target)throw failure(404,'Account not found');
   if(uid===setting(db,'super_admin_user_id')||uid===session.user_id)throw failure(403,'Highest administrator account protected');
   if(!active(db,uid))throw failure(403,'Account unavailable');
   if(data.confirmUsername!==target.username)throw failure(400,'Account confirmation required');
   const prior=membership(db,uid);if((prior?.revision||0)!==data.revision)throw failure(409,'Role changed. Reload before editing.');
   const revision=(prior?.revision||0)+1;if(!Number.isSafeInteger(revision))throw failure(409,'Role revision exhausted');
   db.prepare('INSERT INTO site_role_memberships(user_id,role,revision) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,revision=excluded.revision').run(uid,data.role,revision);
   db.prepare('INSERT INTO site_role_audit(id,actor_id,target_id,action,reason,revision,actor_role,created_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),session.user_id,uid,data.role==='admin'?'appoint-admin':'revoke-admin',data.reason.trim(),revision,'super_admin',Date.now());
   result={ok:true,account:{id:uid,username:target.username,role:siteRole(db,uid),revision}};db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
  json(200,result);return true;
 }catch(error){json(error.status||500,{error:error.status?error.message:'Site role request failed'});return true;}
};}
