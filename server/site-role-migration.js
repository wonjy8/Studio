import {privateBackup} from './account-migration.js';
import {setupSiteRoles} from './site-roles.js';
import {setupAdminProjects} from './admin-projects.js';
const required=['site_role_memberships','site_role_audit','admin_project_audit'];
// Called only after the explicit runtime opt-in. It creates no role assignments.
export async function prepareSiteRoleSchema(db,dir){
 const existing=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 if(required.every(name=>existing.has(name)))return;
 if(db.prepare('SELECT count(*) n FROM users').get().n)await privateBackup(db,dir);
 db.exec('BEGIN IMMEDIATE');
 try{setupSiteRoles(db);setupAdminProjects(db);for(const name of required)if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name))throw Error('Site role schema incomplete');db.exec('COMMIT');}
 catch(error){db.exec('ROLLBACK');throw error;}
}
