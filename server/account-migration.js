import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,chmod,open} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setupAccounts} from './accounts.js';
const tables=['password_changes','account_profiles','account_status','admin_audit','equipment_items','equipment_links','project_accounts','project_teams','project_team_members'];
export async function prepareAccountSchema(db,dir){
 const existing=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 if(tables.every(name=>existing.has(name)))return;
 // A SQLite online backup includes committed WAL data. It stays private in the data volume.
 if(db.prepare('SELECT count(*) AS n FROM users').get().n){
  const destination=join(dir,'backups');await mkdir(destination,{recursive:true,mode:0o700});await chmod(destination,0o700);
  const file=join(destination,`before-project-accounts-${Date.now()}-${randomUUID()}.sqlite`);
  const handle=await open(file,'wx',0o600);await handle.close();
  await backup(db,file);await chmod(file,0o600);
  const snapshot=new DatabaseSync(file);try{snapshot.exec('PRAGMA journal_mode=DELETE');}finally{snapshot.close();}
 }
 db.exec('BEGIN IMMEDIATE');
 try{setupAccounts(db);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}
