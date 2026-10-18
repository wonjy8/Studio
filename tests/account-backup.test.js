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

import {setupAccounts} from '../server/accounts.js';
import {accountSchemaTables} from '../server/account-migration.js';
import {inventoryTables,setupInventory,inventorySchema,allocateLoanNumber} from '../server/inventory.js';
function legacyAccountFixture(db){
 setupAccounts(db);db.exec('PRAGMA wal_autocheckpoint=0');
 for(const id of ['fictional-owner','fictional-invitee'])db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'fictional-hash');
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-owner')").run();
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('fictional-session','fictional-owner',12345);
 db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('fictional-owner',17,'{"fictional":"existing workspace and canonical IDs retained"}');
 db.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run('fictional-file','fictional-owner','fixture.pdf','application/pdf',Buffer.from('%PDF-fictional-wal'));
 db.prepare('INSERT INTO password_changes VALUES(?)').run('fictional-invitee');
 db.prepare('INSERT INTO account_profiles VALUES(?,?)').run('fictional-owner','Fictional Profile');
 db.prepare('INSERT INTO account_status VALUES(?,?,?)').run('fictional-invitee',123456,null);
 db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run('fictional-audit','fictional-owner','fictional-invitee','restore','Fictional fixture',123);
 db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run('canonical-existing-camera','fictional-owner','Fictional Existing Camera','camera');
 db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?)').run('fictional-owner','fictional-project','legacy-gear-id','canonical-existing-camera','fictional-member-owner','fictional-member-assignee');
 db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run('fictional-owner','fictional-project','fictional-invitee','fictional-member-assignee',123);
 db.prepare('INSERT INTO project_teams VALUES(?,?,?,?)').run('fictional-team','fictional-owner','fictional-project','Fictional Team');
 db.prepare('INSERT INTO project_team_members VALUES(?,?)').run('fictional-team','fictional-member-assignee');
}
const tableNames=db=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>row.name);
const rowsOf=(db,tables)=>Object.fromEntries(tables.map(name=>[name,db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
test('existing complete nine-table account database triggers private WAL backup before additive inventory expansion',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-inventory-upgrade-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});legacyAccountFixture(db);
 const legacyTables=tableNames(db),before=rowsOf(db,legacyTables),schemaBefore=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
 assert.ok((await stat(join(dir,'studio.sqlite-wal'))).size>0,'populated source has committed WAL bytes');
 await prepareAccountSchema(db,dir);
 assert.deepEqual(rowsOf(db,legacyTables),before);for(const row of schemaBefore)assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(row.name).sql,row.sql,'legacy table shape stays positional-insert compatible');
 for(const name of accountSchemaTables)assert.ok(tableNames(db).includes(name));assert.equal(inventoryTables.length,11);for(const name of ['inventory_sequences','inventory_loan_numbers','inventory_serials'])assert.ok(accountSchemaTables.includes(name));
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const backups=await readdir(join(dir,'backups'));assert.equal(backups.length,1);const backupPath=join(dir,'backups',backups[0]);assert.equal((await stat(backupPath)).mode&0o777,0o600);assert.equal((await stat(join(dir,'backups'))).mode&0o777,0o700);
 const restored=new DatabaseSync(backupPath,{readOnly:true});try{assert.deepEqual(rowsOf(restored,legacyTables),before);for(const name of inventoryTables)assert.equal(tableNames(restored).includes(name),false,'backup precedes inventory DDL');assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{restored.close();}
 assert.equal(db.prepare('SELECT equipment_id FROM equipment_links WHERE gear_id=?').get('legacy-gear-id').equipment_id,'canonical-existing-camera');
 // Existing callers still use their original positional inserts after the additive upgrade.
 db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run('canonical-new','fictional-owner','Fictional New Camera','camera');db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?)').run('fictional-owner','fictional-second-project','legacy-new-gear','canonical-new',null,null);
 const after=rowsOf(db,tableNames(db));await prepareAccountSchema(db,dir);assert.equal((await readdir(join(dir,'backups'))).length,1);assert.deepEqual(rowsOf(db,tableNames(db)),after);
});
test('partial populated inventory upgrade backs up serial metadata with canonical legacy IDs and all history on retry',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-inventory-partial-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});legacyAccountFixture(db);setupInventory(db);
 db.prepare('INSERT INTO inventory_organizations VALUES(?,?,?,?)').run('fictional-org','fictional-owner','Fictional Organization',123);
 db.prepare('INSERT INTO inventory_operators VALUES(?,?)').run('fictional-org','fictional-invitee');
 db.prepare('INSERT INTO inventory_metadata VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('canonical-existing-camera','FIX-001','Fictional Model','individual',1,'Fictional Shelf','Good','Fictional Custodian','organization','fictional-org',4);
 db.prepare('INSERT INTO inventory_serials VALUES(?,?)').run('canonical-existing-camera','FICTIONAL-SERIAL-001');
 db.prepare('INSERT INTO inventory_loans VALUES(?,?,?,?,?,?,?,?)').run('fictional-loan','fictional-owner','Fictional Borrower','Fictional Team','Fictional Set','2099-01-01T12:00:00Z','Fictional loan',123);
 db.prepare('INSERT INTO inventory_loan_lines VALUES(?,?,?,?,?)').run('fictional-line','fictional-loan','canonical-existing-camera',1,'{"name":"Fictional snapshot"}');
 db.prepare('INSERT INTO inventory_returns VALUES(?,?,?,?,?)').run('fictional-return','fictional-loan','fictional-invitee','Fictional returned',124);
 db.prepare('INSERT INTO inventory_return_lines VALUES(?,?,?)').run('fictional-return','fictional-line',1);
 db.prepare('INSERT INTO inventory_requests VALUES(?,?,?,?)').run('fictional-owner','fictional-request','fictional-hash','{"id":"fictional-loan"}');
 db.prepare('INSERT INTO inventory_sequences VALUES(?,?,?)').run('fictional-owner','2026-10',8);db.prepare('INSERT INTO inventory_loan_numbers VALUES(?,?,?,?,?,?)').run('fictional-loan','fictional-owner','fictional-owner','2026-10',7,'2026-10-007');
 // Simulate an interrupted additive rollout by omitting one table while retaining its committed rows in the other relations.
 db.exec('CREATE TABLE fictional_retained_extension(id TEXT PRIMARY KEY, value BLOB)');db.prepare('INSERT INTO fictional_retained_extension VALUES(?,?)').run('fixture',Buffer.from('Fictional retained extension'));
 db.exec('DROP TABLE password_changes');const tables=tableNames(db),before=rowsOf(db,tables);await prepareAccountSchema(db,dir);assert.deepEqual(rowsOf(db,tables),before);
 const backups=await readdir(join(dir,'backups'));assert.equal(backups.length,1);const snapshot=new DatabaseSync(join(dir,'backups',backups[0]),{readOnly:true});try{assert.deepEqual(rowsOf(snapshot,tables),before);for(const name of inventoryTables)assert.ok(tableNames(snapshot).includes(name));assert.equal(snapshot.prepare('SELECT serial_number FROM inventory_serials WHERE equipment_id=?').get('canonical-existing-camera').serial_number,'FICTIONAL-SERIAL-001');assert.equal(snapshot.prepare('SELECT equipment_id FROM equipment_links WHERE gear_id=?').get('legacy-gear-id').equipment_id,'canonical-existing-camera');}finally{snapshot.close();}
 await prepareAccountSchema(db,dir);assert.deepEqual(rowsOf(db,tables),before);assert.equal((await readdir(join(dir,'backups'))).length,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('inventory DDL failure rolls back all new tables and retry preserves canonical links and private backups',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-inventory-rollback-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});legacyAccountFixture(db);
 const conflict=inventoryTables.at(-1);db.exec(`CREATE VIEW ${conflict} AS SELECT 'fictional' AS id`);const tables=tableNames(db),before=rowsOf(db,tables);
 await assert.rejects(prepareAccountSchema(db,dir));assert.deepEqual(tableNames(db),tables,'all earlier CREATE TABLE statements rolled back');assert.deepEqual(rowsOf(db,tables),before);assert.equal((await readdir(join(dir,'backups'))).length,1);
 db.exec(`DROP VIEW ${conflict}`);await prepareAccountSchema(db,dir);assert.deepEqual(rowsOf(db,tables),before);for(const name of inventoryTables)assert.ok(tableNames(db).includes(name));assert.equal((await readdir(join(dir,'backups'))).length,2,'each attempt retains its valid pre-migration restore point');await prepareAccountSchema(db,dir);assert.equal((await readdir(join(dir,'backups'))).length,2);
});
test('existing eight-table inventory receives additive number and serial tables without renumbering historical loans',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-inventory-numbers-upgrade-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});legacyAccountFixture(db);setupInventory(db);
 db.prepare('INSERT INTO inventory_loans VALUES(?,?,?,?,?,?,?,?)').run('historical-loan-uuid','fictional-owner','Fictional Borrower','Fictional Team','Fictional Set','2099-01-01T12:00:00Z','Fictional retained history',123);
 db.prepare('INSERT INTO inventory_loan_lines VALUES(?,?,?,?,?)').run('historical-line-uuid','historical-loan-uuid','canonical-existing-camera',1,'{"name":"Fictional Original Camera"}');
 db.prepare('INSERT INTO inventory_requests VALUES(?,?,?,?)').run('fictional-owner','historical-request','fictional-hash','{"id":"historical-loan-uuid"}');
 db.exec('DROP TABLE inventory_loan_numbers; DROP TABLE inventory_sequences; DROP TABLE inventory_serials');const tables=tableNames(db),before=rowsOf(db,tables);
 await prepareAccountSchema(db,dir);assert.deepEqual(rowsOf(db,tables),before);assert.equal(db.prepare('SELECT count(*) n FROM inventory_loan_numbers').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM inventory_sequences').get().n,0,'schema upgrade allocates no unsolicited sequence values');assert.equal(db.prepare('SELECT count(*) n FROM inventory_serials').get().n,0,'schema upgrade invents no serial numbers');
 assert.equal(db.prepare('SELECT id FROM inventory_loans').get().id,'historical-loan-uuid');assert.equal(db.prepare('SELECT equipment_id FROM inventory_loan_lines').get().equipment_id,'canonical-existing-camera');
 const backups=await readdir(join(dir,'backups'));assert.equal(backups.length,1);const snapshot=new DatabaseSync(join(dir,'backups',backups[0]),{readOnly:true});try{assert.deepEqual(rowsOf(snapshot,tables),before);assert.equal(tableNames(snapshot).includes('inventory_loan_numbers'),false);assert.equal(tableNames(snapshot).includes('inventory_sequences'),false);}finally{snapshot.close();}
 await prepareAccountSchema(db,dir);assert.equal((await readdir(join(dir,'backups'))).length,1);assert.deepEqual(rowsOf(db,tables),before);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('existing annual numbering schema is privately backed up before period rename and issued numbers remain immutable',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-inventory-monthly-upgrade-'));const db=openStore(dir);t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});legacyAccountFixture(db);
 // Reconstruct the previous two-table contract, retaining the same canonical loan UUIDs.
 db.exec(inventorySchema.replace(/\bperiod TEXT\b/g,'year INTEGER').replace(/\bperiod\b/g,'year'));
 db.prepare('INSERT INTO inventory_loans VALUES(?,?,?,?,?,?,?,?)').run('issued-annual-loan-uuid','fictional-owner','Fictional Borrower','Fictional Team','Fictional Set','2099-01-01T12:00:00Z','Fictional issued annual number',123);
 db.prepare('INSERT INTO inventory_loan_lines VALUES(?,?,?,?,?)').run('issued-line-uuid','issued-annual-loan-uuid','canonical-existing-camera',1,'{"name":"Fictional issued snapshot"}');
 db.prepare('INSERT INTO inventory_requests VALUES(?,?,?,?)').run('fictional-owner','issued-annual-request','fictional-hash','{"id":"issued-annual-loan-uuid"}');
 db.prepare('INSERT INTO inventory_sequences VALUES(?,?,?)').run('fictional-owner',2026,8);db.prepare('INSERT INTO inventory_loan_numbers VALUES(?,?,?,?,?,?)').run('issued-annual-loan-uuid','fictional-owner','fictional-original-username',2026,7,'2026-0007');
 const tables=tableNames(db),before=rowsOf(db,tables),annualNumber={...db.prepare('SELECT * FROM inventory_loan_numbers').get()},annualSequence={...db.prepare('SELECT * FROM inventory_sequences').get()};
 assert.ok(accountSchemaTables.every(name=>tables.includes(name)),'all tracked table names already exist, so column migration detection is required');
 await prepareAccountSchema(db,dir);
 for(const name of tables.filter(name=>!['inventory_sequences','inventory_loan_numbers'].includes(name)))assert.deepEqual(rowsOf(db,[name])[name],before[name],name+' unchanged');
 for(const name of ['inventory_sequences','inventory_loan_numbers']){const columns=db.prepare(`PRAGMA table_info(${name})`).all().map(row=>row.name);assert.ok(columns.includes('period'));assert.equal(columns.includes('year'),false);}
 const {year:numberYear,...oldNumber}=annualNumber,{year:sequenceYear,...oldSequence}=annualSequence;assert.deepEqual({...db.prepare('SELECT * FROM inventory_loan_numbers').get()},{...oldNumber,period:numberYear});assert.deepEqual({...db.prepare('SELECT * FROM inventory_sequences').get()},{...oldSequence,period:sequenceYear});
 const backups=await readdir(join(dir,'backups'));assert.equal(backups.length,1);const snapshot=new DatabaseSync(join(dir,'backups',backups[0]),{readOnly:true});try{assert.deepEqual(rowsOf(snapshot,tables),before);assert.ok(snapshot.prepare('PRAGMA table_info(inventory_loan_numbers)').all().some(column=>column.name==='year'));}finally{snapshot.close();}
 db.prepare('INSERT INTO inventory_loans VALUES(?,?,?,?,?,?,?,?)').run('new-monthly-loan-uuid','fictional-owner','Fictional Borrower','Fictional Team','Fictional Set','2099-01-01T12:00:00Z','Fictional monthly number',124);
 db.exec('BEGIN IMMEDIATE');try{const issued=allocateLoanNumber(db,'fictional-owner','new-monthly-loan-uuid',Date.parse('2026-10-01T00:00:00+09:00'));assert.equal(issued.displayNumber,'2026-10-001');db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}assert.equal(db.prepare('SELECT display_number FROM inventory_loan_numbers WHERE loan_id=?').get('issued-annual-loan-uuid').display_number,'2026-0007');assert.equal(db.prepare('SELECT next_value FROM inventory_sequences WHERE actor_id=? AND period=?').get('fictional-owner',2026).next_value,8);
 const migrated=rowsOf(db,tables);await prepareAccountSchema(db,dir);assert.deepEqual(rowsOf(db,tables),migrated);assert.equal((await readdir(join(dir,'backups'))).length,1);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
