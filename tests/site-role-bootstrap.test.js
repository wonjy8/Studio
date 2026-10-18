import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.js';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
import {siteRole,setupSiteRoles,configureSiteRoleManagement,claimFirstSiteAdministrator} from '../server/site-roles.js';
const value=(db,key)=>db.prepare('SELECT value FROM site_settings WHERE key=?').get(key)?.value;
async function directory(t){const dir=await mkdtemp(join(tmpdir(),'studio-bootstrap-fictional-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function app(t,dir,enabled){const {server,db}=await createApp({dir,origin:'http://localhost',secure:false,enableSiteRoleManagement:enabled});await new Promise(r=>server.listen(0,'127.0.0.1',r));let closed=false;const close=async()=>{if(closed)return;closed=true;await new Promise(r=>server.close(r));};t.after(close);const base=`http://127.0.0.1:${server.address().port}`;const request=async(path,options={})=>fetch(base+path,{...options,headers:{Origin:'http://localhost',...options.headers}});const login=async username=>{const r=await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'Fictional-password!1'})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};return {db,close,request,login};}
async function seed(db){const password=await hashPassword('Fictional-password!1');for(const id of ['fictional-first','fictional-second'])db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,password);}
test('only a nonexistent explicitly opted-in database receives first-login eligibility',async t=>{
 const fresh=await directory(t);let db=openStore(fresh,{siteRoleBootstrap:true});assert.equal(value(db,'site_role_bootstrap_state'),'eligible');db.close();db=openStore(fresh,{siteRoleBootstrap:false});assert.equal(value(db,'site_role_bootstrap_state'),'eligible');db.close();
 const old=await directory(t);db=openStore(old);assert.equal(value(db,'site_role_bootstrap_state'),'legacy');db.prepare("DELETE FROM site_settings WHERE key='site_role_bootstrap_state'").run();db.close();db=openStore(old,{siteRoleBootstrap:true});assert.notEqual(value(db,'site_role_bootstrap_state'),'eligible');assert.equal(value(db,'super_admin_user_id'),undefined);db.close();
});
test('two concurrent successful first logins claim exactly one highest account and never reassign on reopen',async t=>{
 const dir=await directory(t);let instance=await app(t,dir,true);await seed(instance.db);
 const results=await Promise.all(['fictional-first','fictional-second'].map(async user=>({user,...await instance.login(user)})));assert.deepEqual(results.map(r=>r.status),[200,200]);
 const bootstrapAudit=instance.db.prepare("SELECT * FROM site_role_audit WHERE action='bootstrap-highest'").all();assert.equal(bootstrapAudit.length,1);assert.equal(bootstrapAudit[0].actor_id,bootstrapAudit[0].target_id);assert.equal(bootstrapAudit[0].revision,1);
 const highest=value(instance.db,'super_admin_user_id');assert.ok(['fictional-first','fictional-second'].includes(highest));assert.equal(value(instance.db,'site_role_first_login_user_id'),highest);assert.equal(value(instance.db,'site_role_bootstrap_state'),'claimed');
 for(const result of results){const session=await (await instance.request('/api/session',{headers:{Cookie:result.cookie}})).json();assert.equal(session.siteRole,result.user===highest?'super_admin':'user');assert.equal(siteRole(instance.db,result.user),result.user===highest?'super_admin':'user');}
 await instance.close();instance=await app(t,dir,true);assert.equal(value(instance.db,'super_admin_user_id'),highest);instance.db.prepare("DELETE FROM site_settings WHERE key='super_admin_user_id'").run();
 assert.equal((await instance.login(highest==='fictional-first'?'fictional-second':'fictional-first')).status,200);assert.equal(value(instance.db,'super_admin_user_id'),undefined);assert.equal(value(instance.db,'site_role_first_login_user_id'),highest);assert.equal(value(instance.db,'site_role_bootstrap_state'),'claimed');
});
test('preexisting installations without birth marker never bootstrap and retain legacy admin',async t=>{
 const dir=await directory(t);const old=openStore(dir);await seed(old);old.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-first')").run();old.prepare("DELETE FROM site_settings WHERE key='site_role_bootstrap_state'").run();old.close();const instance=await app(t,dir,true);assert.equal((await instance.login('fictional-second')).status,200);assert.equal(value(instance.db,'super_admin_user_id'),undefined);assert.equal(siteRole(instance.db,'fictional-first'),'admin');assert.equal(siteRole(instance.db,'fictional-second'),'user');
});
test('disabled successful login consumes prior eligibility without creating new roles',async t=>{
 const dir=await directory(t);const initial=openStore(dir,{siteRoleBootstrap:true});await seed(initial);initial.close();let instance=await app(t,dir,false);assert.equal((await instance.login('fictional-first')).status,200);assert.equal(value(instance.db,'site_role_bootstrap_state'),'held');assert.equal(value(instance.db,'super_admin_user_id'),undefined);assert.equal(instance.db.prepare("SELECT name FROM sqlite_master WHERE name='site_role_memberships'").get(),undefined);await instance.close();instance=await app(t,dir,true);assert.equal((await instance.login('fictional-second')).status,200);assert.equal(value(instance.db,'super_admin_user_id'),undefined);assert.equal(value(instance.db,'site_role_bootstrap_state'),'held');
});
test('existing highest or first-login markers permanently block eligibility rather than promoting another account',async t=>{
 const dir=await directory(t);const db=openStore(dir,{siteRoleBootstrap:true});t.after(()=>db.close());await seed(db);setupSiteRoles(db);configureSiteRoleManagement(db,true);db.prepare("INSERT INTO site_settings VALUES('super_admin_user_id','fictional-first')").run();assert.equal(claimFirstSiteAdministrator(db,'fictional-second'),false);assert.equal(value(db,'site_role_bootstrap_state'),'blocked');db.prepare("DELETE FROM site_settings WHERE key='super_admin_user_id'").run();assert.equal(claimFirstSiteAdministrator(db,'fictional-second'),false);assert.equal(value(db,'super_admin_user_id'),undefined);
 db.prepare("UPDATE site_settings SET value='eligible' WHERE key='site_role_bootstrap_state'").run();db.prepare("INSERT INTO site_settings VALUES('site_role_first_login_user_id','fictional-first')").run();assert.equal(claimFirstSiteAdministrator(db,'fictional-second'),false);assert.equal(value(db,'site_role_bootstrap_state'),'blocked');assert.equal(value(db,'super_admin_user_id'),undefined);
});

test('first-login audit failure atomically rolls back highest markers and session creation',async t=>{
 const dir=await directory(t),instance=await app(t,dir,true);await seed(instance.db);
 instance.db.exec("CREATE TRIGGER fictional_bootstrap_audit_failure BEFORE INSERT ON site_role_audit BEGIN SELECT RAISE(ABORT,'fictional isolated failure'); END");
 const failed=await instance.login('fictional-first');assert.equal(failed.status,500);assert.equal(failed.cookie,undefined);assert.equal(value(instance.db,'super_admin_user_id'),undefined);assert.equal(value(instance.db,'site_role_first_login_user_id'),undefined);assert.equal(value(instance.db,'site_role_bootstrap_state'),'eligible');assert.equal(instance.db.prepare('SELECT count(*) n FROM sessions').get().n,0);assert.equal(instance.db.prepare('SELECT count(*) n FROM site_role_audit').get().n,0);
 instance.db.exec('DROP TRIGGER fictional_bootstrap_audit_failure');assert.equal((await instance.login('fictional-second')).status,200);assert.equal(value(instance.db,'super_admin_user_id'),'fictional-second');
});
