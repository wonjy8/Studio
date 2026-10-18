import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server/index.js';
import {prepareSiteRoleSchema} from '../server/site-role-migration.js';
const names=['site_role_memberships','site_role_audit','admin_project_audit'];
const exists=(db,name)=>Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
test('site-role schema is opt-in, backed up once, retains old rows and never assigns grades',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-site-migration-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 let app=await createApp({dir,origin:'http://localhost',secure:false});app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-legacy','fictional-legacy','fictional-unused-hash');app.db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-legacy')").run();
 for(const name of names)assert.equal(exists(app.db,name),false);const before=app.db.prepare('SELECT * FROM users').all();app.db.close();
 app=await createApp({dir,origin:'http://localhost',secure:false,enableSiteRoleManagement:true});for(const name of names)assert.equal(exists(app.db,name),true);assert.deepEqual(app.db.prepare('SELECT * FROM users').all(),before);assert.equal(app.db.prepare('SELECT count(*) n FROM site_role_memberships').get().n,0);assert.equal(app.db.prepare("SELECT value FROM site_settings WHERE key='super_admin_user_id'").get(),undefined);assert.equal(app.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(app.db.prepare('PRAGMA foreign_key_check').all(),[]);app.db.close();
 const backups=await readdir(join(dir,'backups'));assert.equal(backups.length,1);const backup=new DatabaseSync(join(dir,'backups',backups[0]));assert.deepEqual(backup.prepare('SELECT * FROM users').all(),before);for(const name of names)assert.equal(exists(backup,name),false);backup.close();
 app=await createApp({dir,origin:'http://localhost',secure:false,enableSiteRoleManagement:true});app.db.close();assert.equal((await readdir(join(dir,'backups'))).length,1);
});
test('schema failure rolls back partial role tables and an explicit retry succeeds',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-site-migration-failure-'));t.after(()=>rm(dir,{recursive:true,force:true}));const app=await createApp({dir,origin:'http://localhost',secure:false});t.after(()=>app.db.close());
 let injected=false;const db=new Proxy(app.db,{get(target,key){if(key==='exec')return sql=>{if(sql.includes('CREATE TABLE IF NOT EXISTS admin_project_audit')){injected=true;throw Error('Fictional migration fault');}return target.exec(sql);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(prepareSiteRoleSchema(db,dir),/Fictional migration fault/);assert.equal(injected,true);for(const name of names)assert.equal(exists(app.db,name),false);await prepareSiteRoleSchema(app.db,dir);for(const name of names)assert.equal(exists(app.db,name),true);assert.equal(app.db.prepare('SELECT count(*) n FROM site_role_memberships').get().n,0);
});
