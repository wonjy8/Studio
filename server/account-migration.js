import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,chmod,open,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setupAccounts} from './accounts.js';
import {inventoryTables,setupInventory} from './inventory.js';
export const accountSchemaTables=Object.freeze(['password_changes','account_profiles','account_status','admin_audit','equipment_items','equipment_links','project_accounts','project_teams','project_team_members',...inventoryTables]);
const monthlyNumberSchema=db=>['inventory_sequences','inventory_loan_numbers'].every(name=>{const columns=db.prepare(`PRAGMA table_info(${name})`).all().map(column=>column.name);return columns.includes('period')&&!columns.includes('year');});
const existingTables=db=>new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
async function privateBackup(db,dir){
 // A SQLite online backup includes committed WAL data. It stays private in the data volume.
 const destination=join(dir,'backups');await mkdir(destination,{recursive:true,mode:0o700});await chmod(destination,0o700);
 const file=join(destination,`before-project-accounts-${Date.now()}-${randomUUID()}.sqlite`);
 const handle=await open(file,'wx',0o600);await handle.close();
 try{
  await backup(db,file);await chmod(file,0o600);
  const snapshot=new DatabaseSync(file);try{snapshot.exec('PRAGMA journal_mode=DELETE');if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Private schema backup failed integrity verification');}finally{snapshot.close();}
 }catch(error){
  // Failed/partial files must not look like usable restore points on a later retry.
  await Promise.all([file,file+'-wal',file+'-shm'].map(path=>rm(path,{force:true}).catch(()=>{})));throw error;
 }
}
export async function prepareAccountSchema(db,dir){
 const existing=existingTables(db);if(accountSchemaTables.every(name=>existing.has(name))&&monthlyNumberSchema(db))return;
 if(db.prepare('SELECT count(*) AS n FROM users').get().n)await privateBackup(db,dir);
 db.exec('BEGIN IMMEDIATE');
 try{
  setupAccounts(db);setupInventory(db);
  const tables=existingTables(db);if(!accountSchemaTables.every(name=>tables.has(name))||!monthlyNumberSchema(db))throw Error('Account/inventory schema migration incomplete');
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
