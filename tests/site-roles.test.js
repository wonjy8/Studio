import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {configureSiteRoleManagement,setupSiteRoles,siteRole,siteCapabilities,isAdmin,isSuperAdmin,isProtectedSiteAccount,siteRoleRoutes} from '../server/site-roles.js';
async function fixture(t,{enabled=true,pinned=true}={}){
 const dir=await mkdtemp(join(tmpdir(),'studio-site-roles-fictional-'));const {server,db}=await createApp({dir,origin:'http://localhost',secure:false});
 for(const uid of ['fictional-highest','fictional-admin','fictional-user','fictional-legacy','fictional-other']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-legacy')").run();if(pinned)db.prepare("INSERT INTO site_settings VALUES('super_admin_user_id','fictional-highest')").run();
 setupSiteRoles(db);configureSiteRoleManagement(db,enabled);const handle=siteRoleRoutes(db);
 const call=async(actor,path='/api/admin/site-roles',method='GET',data,onRead)=>{let result;const session=actor?{user_id:actor,token:digest(actor)}:null;await handle({path,req:{method},session,json:(status,body)=>{result={status,body};},readJson:async()=>{if(onRead)await onRead();return data;}});return result;};
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const accountAction=async(actor,target,action)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${target}/actions`,{method:'POST',headers:{Origin:'http://localhost',Cookie:'studio_session='+actor,'Content-Type':'application/json'},body:JSON.stringify({action,confirmUsername:target,reason:'Fictional safety test',...(action==='suspend'?{until:null}:{})})});return r.status;};
 const assign=(target,role,revision=0)=>({role,revision,confirmUsername:target,reason:'Fictional reviewed role assignment'});
 const accountList=async actor=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users`,{headers:{Origin:'http://localhost',Cookie:'studio_session='+actor}});assert.equal(r.status,200);return (await r.json()).users;};
 return {db,call,assign,accountAction,accountList};
}
test('explicit highest provisioning and runtime opt-in are required; legacy administration remains bounded',async t=>{
 const {db,call}=await fixture(t,{enabled:false});assert.equal(siteRole(db,'fictional-highest'),'user');assert.equal(isAdmin(db,'fictional-legacy'),true);assert.equal(siteCapabilities(db,'fictional-legacy').canManageProjects,false);assert.equal((await call('fictional-highest')).status,403);assert.equal(isProtectedSiteAccount(db,'fictional-highest'),true);
 configureSiteRoleManagement(db,true);assert.equal(isSuperAdmin(db,'fictional-highest'),true);assert.equal(isAdmin(db,'fictional-legacy'),false);assert.equal(siteCapabilities(db,'fictional-highest').canManageSiteRoles,true);
 db.prepare("DELETE FROM site_settings WHERE key='super_admin_user_id'").run();assert.equal(isAdmin(db,'fictional-legacy'),true);assert.equal(siteCapabilities(db,'fictional-legacy').canManageProjects,false);assert.equal((await call('fictional-legacy')).status,403);assert.equal(db.prepare("SELECT value FROM site_settings WHERE key='super_admin_user_id'").get(),undefined);
 db.prepare("INSERT INTO site_settings VALUES('super_admin_user_id','fictional-missing')").run();assert.equal(isAdmin(db,'fictional-legacy'),false);assert.equal(siteCapabilities(db,'fictional-highest').canManageProjects,false);
});
test('only live highest sessions appoint and revoke delegated administrators with revision and minimal audit',async t=>{
 const {db,call,assign}=await fixture(t);assert.equal((await call(null)).status,401);assert.equal((await call('fictional-user')).status,403);
 const appointed=await call('fictional-highest','/api/admin/site-roles/fictional-admin','PUT',assign('fictional-admin','admin'));assert.equal(appointed.status,200);assert.equal(appointed.body.account.revision,1);assert.equal(siteRole(db,'fictional-admin'),'admin');assert.equal(siteCapabilities(db,'fictional-admin').canManageProjects,true);assert.equal(siteCapabilities(db,'fictional-admin').canManageSiteRoles,false);
 assert.equal((await call('fictional-admin','/api/admin/site-roles/fictional-user','PUT',assign('fictional-user','admin'))).status,403);assert.equal((await call('fictional-highest','/api/admin/site-roles/fictional-admin','PUT',assign('fictional-admin','user',0))).status,409);
 assert.equal((await call('fictional-highest','/api/admin/site-roles/fictional-admin','PUT',assign('fictional-admin','user',1))).status,200);assert.equal(isAdmin(db,'fictional-admin'),false);assert.equal(siteCapabilities(db,'fictional-admin').canManageProjects,false);assert.equal(db.prepare('SELECT token FROM sessions WHERE user_id=?').get('fictional-admin').token,digest('fictional-admin'));
 const audit=db.prepare('SELECT * FROM site_role_audit ORDER BY rowid').all();assert.equal(audit.length,2);assert.deepEqual(audit.map(row=>row.revision),[1,2]);assert.deepEqual(audit.map(row=>row.action),['appoint-admin','revoke-admin']);for(const field of ['password','token','body','workspace'])assert.equal(Object.hasOwn(audit[0],field),false);
 const list=await call('fictional-highest');assert.equal(list.status,200);assert.equal(list.body.accounts.find(user=>user.id==='fictional-admin').revision,2);assert.equal(JSON.stringify(list.body).includes('unused-fictional-hash'),false);
});
test('role validation rejects highest assignment, forged authority, unsafe targets and stale session races without writes',async t=>{
 const {db,call,assign}=await fixture(t);const path='/api/admin/site-roles/fictional-user';
 for(const data of [{...assign('fictional-user','admin'),role:'super_admin'},{...assign('fictional-user','admin'),actorId:'fictional-highest'},{...assign('fictional-user','admin'),ownerId:'fictional-highest'},{...assign('fictional-user','admin'),revision:-1},{...assign('fictional-user','admin'),confirmUsername:'wrong'},{...assign('fictional-user','admin'),reason:''}])assert.equal((await call('fictional-highest',path,'PUT',data)).status,400);
 assert.equal((await call('fictional-highest','/api/admin/site-roles/fictional-highest','PUT',assign('fictional-highest','user'))).status,403);
 db.prepare('INSERT INTO account_status VALUES(?,?,?)').run('fictional-user',Date.now()+600000,null);assert.equal((await call('fictional-highest',path,'PUT',assign('fictional-user','admin'))).status,403);db.prepare('DELETE FROM account_status WHERE user_id=?').run('fictional-user');
 const raced=await call('fictional-highest',path,'PUT',assign('fictional-user','admin'),()=>db.prepare('DELETE FROM sessions WHERE user_id=?').run('fictional-highest'));assert.equal(raced.status,401);assert.equal(siteRole(db,'fictional-user'),'user');assert.equal(db.prepare('SELECT count(*) n FROM site_role_audit').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM site_role_memberships').get().n,0);
});
test('highest and delegated accounts stay protected from destructive account actions, including disabled grades',async t=>{
 const {db,call,assign,accountAction,accountList}=await fixture(t);assert.equal((await call('fictional-highest','/api/admin/site-roles/fictional-admin','PUT',assign('fictional-admin','admin'))).status,200);
 const users=await accountList('fictional-highest');assert.equal(users.find(user=>user.id==='fictional-highest').siteRole,'super_admin');assert.equal(users.find(user=>user.id==='fictional-highest').protected,true);assert.equal(users.find(user=>user.id==='fictional-admin').siteRole,'admin');assert.equal(users.find(user=>user.id==='fictional-admin').protected,true);assert.equal(users.find(user=>user.id==='fictional-user').protected,false);
 for(const action of ['reset-password','suspend','restore','delete']){assert.equal(await accountAction('fictional-admin','fictional-highest',action),403);assert.equal(await accountAction('fictional-highest','fictional-highest',action),403);assert.equal(await accountAction('fictional-highest','fictional-admin',action),403);}
 db.prepare('INSERT INTO account_status VALUES(?,?,?)').run('fictional-admin',null,Date.now());assert.equal(isAdmin(db,'fictional-admin'),false);assert.equal(isProtectedSiteAccount(db,'fictional-admin'),true);assert.equal(await accountAction('fictional-highest','fictional-admin','reset-password'),403);
 configureSiteRoleManagement(db,false);assert.equal(isProtectedSiteAccount(db,'fictional-highest'),true);const disabledUsers=await accountList('fictional-legacy');assert.equal(disabledUsers.find(user=>user.id==='fictional-highest').protected,true);assert.equal(await accountAction('fictional-legacy','fictional-highest','delete'),403);
});

test('pending role writes recheck highest authority and target revision inside the transaction',async t=>{
 const {db,call,assign}=await fixture(t);const path='/api/admin/site-roles/fictional-user';
 const changedAuthority=await call('fictional-highest',path,'PUT',assign('fictional-user','admin'),()=>db.prepare("UPDATE site_settings SET value='fictional-other' WHERE key='super_admin_user_id'").run());assert.equal(changedAuthority.status,403);assert.equal(db.prepare('SELECT count(*) n FROM site_role_audit').get().n,0);
 db.prepare("UPDATE site_settings SET value='fictional-highest' WHERE key='super_admin_user_id'").run();
 const changedRevision=await call('fictional-highest',path,'PUT',assign('fictional-user','admin'),()=>db.prepare("INSERT INTO site_role_memberships VALUES('fictional-user','user',1)").run());assert.equal(changedRevision.status,409);assert.equal(db.prepare('SELECT revision FROM site_role_memberships WHERE user_id=?').get('fictional-user').revision,1);assert.equal(db.prepare('SELECT count(*) n FROM site_role_audit').get().n,0);
});
