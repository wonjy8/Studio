import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../server/store.js';
import {prepareAccountSchema} from '../server/account-migration.js';
test('account schema upgrade privately backs up committed data and preserves all existing rows and privileges',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-schema-backup-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','fictional-hash');
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-owner')").run();
 db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('fictional-owner',7,'{"fictional":"retained"}');
 db.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run('fictional-file','fictional-owner','fixture.pdf','application/pdf',Buffer.from('%PDF-fictional'));
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('fictional-session','fictional-owner',12345);
 const snapshot=()=>Object.fromEntries(['users','site_settings','workspaces','files','sessions'].map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]));const before=snapshot();
 await prepareAccountSchema(db,dir);assert.deepEqual(snapshot(),before);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const files=await readdir(join(dir,'backups'));assert.equal(files.length,1);const path=join(dir,'backups',files[0]);assert.equal((await stat(path)).mode&0o777,0o600);assert.equal((await stat(join(dir,'backups'))).mode&0o777,0o700);
 const restored=new DatabaseSync(path,{readOnly:true});try{for(const table of Object.keys(before))assert.deepEqual(restored.prepare(`SELECT * FROM ${table}`).all(),before[table]);assert.equal(restored.prepare("SELECT count(*) n FROM sqlite_master WHERE name='project_accounts'").get().n,0);}finally{restored.close();}
 await prepareAccountSchema(db,dir);assert.equal((await readdir(join(dir,'backups'))).length,1);assert.deepEqual(snapshot(),before);
});
test('failed private backup prevents account schema expansion',async t=>{
 const {writeFile}=await import('node:fs/promises');const dir=await mkdtemp(join(tmpdir(),'studio-schema-backup-fail-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','fictional-hash');await writeFile(join(dir,'backups'),'fictional obstacle',{mode:0o600});
 await assert.rejects(prepareAccountSchema(db,dir));assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='project_accounts'").get().n,0);assert.equal(db.prepare('SELECT password FROM users').get().password,'fictional-hash');
});
