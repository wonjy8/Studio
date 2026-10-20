import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {prepareAccountSchema} from '../server/account-migration.js';
import {DatabaseSync} from 'node:sqlite';
import {emptyWorkspace} from '../src/domain/workspace.js';
const baseline='db328457fdfcb9e3d2e60e24513376d9a051b618';
test('additive account schema preserves old database rows and old server can reopen it',async t=>{
 let archive;try{archive=execFileSync('git',['archive',baseline],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','ignore']});}catch{t.skip('Historical Git revision unavailable in this distribution');return;}
 const root=await mkdtemp(join(tmpdir(),'studio-migration-compat-'));t.after(()=>rm(root,{recursive:true,force:true}));
 execFileSync('tar',['-x','-C',root],{input:archive});
 const {openStore}=await import(pathToFileURL(join(root,'server/store.js')).href),{createApp}=await import(pathToFileURL(join(root,'server/index.js')).href),{validateWorkspace:oldValid}=await import(pathToFileURL(join(root,'src/domain/workspace.js')).href);
 const dir=join(root,'private-data');let db=openStore(dir);const state=emptyWorkspace();delete state.tasks;delete state.documents;state.project.id='fictional-project';
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','fictional-password-hash');db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-owner')").run();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('fictional-session','fictional-owner',Date.now()+3600000);db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('fictional-owner',7,JSON.stringify(state));db.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run('fictional-file','fictional-owner','fictional.pdf','application/pdf',Buffer.from('%PDF-fictional'));
 const protectedTables=['users','sessions','workspaces','files','site_settings'],before=Object.fromEntries(protectedTables.map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]));
 await prepareAccountSchema(db,dir);await prepareAccountSchema(db,dir);const backups=await readdir(join(dir,'backups'));assert.equal(backups.length,1);assert.equal((await stat(join(dir,'backups'))).mode&0o777,0o700);assert.equal((await stat(join(dir,'backups',backups[0]))).mode&0o777,0o600);const saved=new DatabaseSync(join(dir,'backups',backups[0]));for(const table of protectedTables)assert.deepEqual(saved.prepare(`SELECT * FROM ${table}`).all(),before[table],`backup ${table} includes committed WAL data`);assert.equal(saved.prepare("SELECT name FROM sqlite_master WHERE name='account_status'").get(),undefined);saved.close();for(const table of protectedTables)assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(),before[table],`${table} unchanged`);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
 const old=await createApp({dir,origin:'http://localhost',secure:false});assert.equal(old.db.prepare('SELECT revision FROM workspaces').get().revision,7);assert.equal(oldValid(JSON.parse(old.db.prepare('SELECT body FROM workspaces').get().body)),true);old.db.close();
 assert.equal(oldValid({...state,tasks:[]}),false,'old strict validator cannot save new task-bearing snapshots');
});

test('pre-inventory account server can reopen additive inventory database without changing legacy rows or inventory history',async t=>{
 const revision='95271f5';let archive;try{archive=execFileSync('git',['archive',revision],{maxBuffer:12*1024*1024,stdio:['ignore','pipe','ignore']});}catch{t.skip('Pre-inventory Git revision unavailable in this distribution');return;}
 const root=await mkdtemp(join(tmpdir(),'studio-inventory-compat-'));t.after(()=>rm(root,{recursive:true,force:true}));execFileSync('tar',['-x','-C',root],{input:archive});
 const {createApp}=await import(pathToFileURL(join(root,'server/index.js')).href),{emptyWorkspace:oldEmpty,validateWorkspace:oldValid}=await import(pathToFileURL(join(root,'src/domain/workspace.js')).href);
 const dir=join(root,'fictional-private-data'),old=await createApp({dir,origin:'http://localhost',secure:false}),db=old.db;
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','fictional-hash');db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-owner')").run();
 const state=oldEmpty();state.project.id='fictional-project';state.members=[{id:'fictional-person',name:'Fictional Person',role:'Crew',call:''}];state.gear=[{id:'legacy-gear','name':'Fictional Camera',category:'camera',status:'check',owner:'Fictional Person',assignee:'',equipmentId:'canonical-old',ownerMemberId:'fictional-person',assigneeMemberId:null}];
 db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('fictional-owner',31,JSON.stringify(state));db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run('canonical-old','fictional-owner','Fictional Camera','camera');db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?)').run('fictional-owner','fictional-project','legacy-gear','canonical-old','fictional-person',null);
 const names=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>row.name),snapshot=(source,tables)=>Object.fromEntries(tables.map(name=>[name,source.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));const legacyTables=names(),before=snapshot(db,legacyTables);
 await prepareAccountSchema(db,dir);assert.deepEqual(snapshot(db,legacyTables),before);assert.equal(oldValid(JSON.parse(db.prepare('SELECT body FROM workspaces').get().body)),true);
 db.prepare('INSERT INTO inventory_metadata VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('canonical-old','FIXTURE-001','Fictional Model','individual',1,'Fictional Shelf','Good','Fictional Custodian','personal',null,1);
 db.prepare('INSERT INTO inventory_serials VALUES(?,?)').run('canonical-old','FICTIONAL-LEGACY-SERIAL-001');
 db.prepare('INSERT INTO inventory_loans VALUES(?,?,?,?,?,?,?,?)').run('fictional-loan','fictional-owner','Fictional Borrower','Fictional Team','Fictional Set','2099-01-01T12:00:00Z','Fictional note',123);
 db.prepare('INSERT INTO inventory_loan_lines VALUES(?,?,?,?,?)').run('fictional-line','fictional-loan','canonical-old',1,'{"name":"Fictional Camera"}');
 db.prepare('INSERT INTO inventory_requests VALUES(?,?,?,?)').run('fictional-owner','fictional-idempotency','fictional-hash','{"id":"fictional-loan"}');
 db.prepare('INSERT INTO inventory_sequences VALUES(?,?,?)').run('fictional-owner','2026-10',8);db.prepare('INSERT INTO inventory_loan_numbers VALUES(?,?,?,?,?,?)').run('fictional-loan','fictional-owner','fictional-owner','2026-10',7,'2026-10-007');
 const tables=names(),after=snapshot(db,tables);db.close();
 const reopened=await createApp({dir,origin:'http://localhost',secure:false});try{assert.deepEqual(snapshot(reopened.db,tables),after);assert.equal(reopened.db.prepare('SELECT revision FROM workspaces').get().revision,31);assert.equal(reopened.db.prepare('SELECT equipment_id FROM equipment_links').get().equipment_id,'canonical-old');assert.equal(reopened.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(reopened.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal((await readdir(join(dir,'backups'))).length,1);}finally{reopened.db.close();}
});
