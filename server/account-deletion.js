// Irreversible application deletion is deliberately limited to accounts with no
// shared ownership or historical dependencies. Shared records are never cascaded,
// transferred, or anonymized here. Existing backups follow their retention policy.
import {createHash,randomUUID} from 'node:crypto';
import {siteCapabilities,isProtectedSiteAccount} from './site-roles.js';
const scope='account-and-private-data';
const exists=(db,name)=>Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
const fail=(status,message)=>Object.assign(Error(message),{status});
const relations=[
 ['invitations','created_by=?'],['project_accounts','owner_id=? OR user_id=?'],['project_teams','owner_id=?'],
 ['equipment_items','owner_id=?'],['equipment_links','owner_id=?'],['equipment_project_scope','project_owner_id=?'],['equipment_project_grants','project_owner_id=?'],['equipment_claims','project_owner_id=? OR target_id=?'],
 ['inventory_organizations','owner_id=?'],['inventory_operators','user_id=?'],['inventory_memberships','user_id=?'],['inventory_invitations','user_id=? OR inviter_id=?'],['inventory_site_invitations','inviter_id=?'],['inventory_project_approvals','project_owner_id=? OR approved_by=?'],
 ['inventory_loans','actor_id=?'],['inventory_returns','actor_id=?'],['inventory_sequences','actor_id=?'],['inventory_loan_numbers','issuer_id=?'],['inventory_requests','actor_id=?'],
 ['admin_audit','actor_id=? OR target_id=?'],['site_role_audit','actor_id=? OR target_id=?'],['admin_project_audit','actor_id=? OR owner_id=?']
];
const privateTables=[['users','id=?'],['password_changes','user_id=?'],['account_profiles','user_id=?'],['account_status','user_id=?'],['sessions','user_id=?'],['workspaces','user_id=?'],['files','user_id=?'],['oauth_codes','user_id=?'],['oauth_grants','user_id=?'],['integration_proposals','user_id=?'],['oauth_manual_clients','owner_id=?'],['site_role_memberships','user_id=?']];
const parameters=(predicate,uid)=>Array((predicate.match(/\?/g)||[]).length).fill(uid);
const rows=(db,table,predicate,uid)=>exists(db,table)?db.prepare(`SELECT * FROM ${table} WHERE ${predicate} ORDER BY rowid`).all(...parameters(predicate,uid)):[];
function active(db,uid){const row=exists(db,'account_status')&&db.prepare('SELECT * FROM account_status WHERE user_id=?').get(uid);return !row||(row.deleted_at==null&&(!row.suspended_until||row.suspended_until<=Date.now()));}
function assertActor(db,session){if(!siteCapabilities(db,session.user_id).canDeleteAccounts||!active(db,session.user_id))throw fail(403,'Administrator required');if(!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,session.user_id,Date.now()))throw fail(401,'Session changed. Sign in again');if(exists(db,'password_changes')&&db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(session.user_id))throw fail(403,'Password change required');}
function references(value,uid,filePaths,key=''){
 if(typeof value==='string')return (['accountId','ownerId','ownerAccountId','userId'].includes(key)&&value===uid)||filePaths.some(path=>value.includes(path));
 if(Array.isArray(value))return value.some(entry=>references(entry,uid,filePaths));
 return value&&typeof value==='object'?Object.entries(value).some(([field,entry])=>references(entry,uid,filePaths,field)):false;
}
function preview(db,actorId,uid){
 const target=db.prepare('SELECT id,username FROM users WHERE id=?').get(uid);if(!target)throw fail(404,'Account not found');
 const blockers=[],hash=createHash('sha256');const evidence=[];const block=(kind,count)=>{if(count)blockers.push({kind,count});};
 block('self_account',actorId===uid?1:0);block('protected_account',isProtectedSiteAccount(db,uid)?1:0);
 for(const [table,predicate] of relations){const found=rows(db,table,predicate,uid);block(table,found.length);evidence.push([table,found]);}
 // Unknown additive user foreign keys fail closed until a deletion policy exists.
 const known=new Set([...relations,...privateTables].map(([table])=>table));
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
  if(known.has(name))continue;
  for(const ref of db.prepare('PRAGMA foreign_key_list("'+name.replaceAll('"','""')+'")').all())if(ref.table==='users'){
   const column='"'+ref.from.replaceAll('"','""')+'"';const found=db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" WHERE '+column+'=?').all(uid);block('unreviewed_reference:'+name,found.length);evidence.push([name,found]);
  }
 }
 if(exists(db,'inventory_loan_lines'))for(const line of db.prepare('SELECT id,snapshot FROM inventory_loan_lines ORDER BY id').all()){let snapshot;try{snapshot=JSON.parse(line.snapshot);}catch{block('unreadable_loan_snapshot',1);evidence.push(['unreadable_loan_snapshot',line]);continue;}if(snapshot?.ownerId===uid){block('loan_snapshot_owner',1);evidence.push(['loan_snapshot_owner',line]);}}
 const first=db.prepare("SELECT value FROM site_settings WHERE key='site_role_first_login_user_id'").get();block('first_login_identity',first?.value===uid?1:0);
 for(const [table,predicate] of privateTables)evidence.push([table,rows(db,table,predicate,uid)]);
 const manual=rows(db,'oauth_manual_clients','owner_id=?',uid);for(const client of manual){
  for(const table of ['oauth_grants','oauth_codes'])if(exists(db,table)){const other=db.prepare(`SELECT * FROM ${table} WHERE client_id=? AND user_id<>? ORDER BY rowid`).all(client.client_id,uid);block('shared_owned_client:'+table,other.length);evidence.push([table,other]);}
  for(const table of ['oauth_clients','oauth_requests','oauth_callback_mismatches'])if(exists(db,table))evidence.push([table,db.prepare(`SELECT * FROM ${table} WHERE ${table==='oauth_clients'?'id':'client_id'}=? ORDER BY rowid`).all(client.client_id)]);
 }
 if(exists(db,'integration_proposals')&&exists(db,'oauth_grants')){const other=db.prepare('SELECT * FROM integration_proposals WHERE user_id<>? AND grant_id IN (SELECT id FROM oauth_grants WHERE user_id=?)').all(uid,uid);block('shared_grant_proposals',other.length);evidence.push(['shared_grant_proposals',other]);}
 const filePaths=rows(db,'files','user_id=?',uid).flatMap(file=>['/api/files/'+file.id,'/api/files/'+encodeURIComponent(file.id)]);
 for(const workspace of db.prepare('SELECT user_id,revision,body FROM workspaces WHERE user_id<>? ORDER BY user_id').all(uid)){
  let parsed;try{parsed=JSON.parse(workspace.body);}catch{block('unreadable_foreign_workspace',1);evidence.push(['unreadable_foreign_workspace',workspace]);continue;}
  if(references(parsed,uid,filePaths)){block('foreign_workspace_reference',1);evidence.push(['foreign_workspace_reference',workspace]);}
 }
 // Hash is opaque: private values, credential hashes and file bytes never leave this service.
 for(const entry of [actorId,target,blockers,evidence])hash.update(JSON.stringify(entry,(_key,value)=>value instanceof Uint8Array?{byteLength:value.byteLength,sha256:createHash('sha256').update(value).digest('hex')}:value));
 return {target,allowed:blockers.length===0,blockers,scope,expectedSnapshot:hash.digest('hex'),warning:'Permanent deletion removes this account and its private data. It cannot be restored in the app. Existing backups retain their separate retention policy.'};
}
export function accountDeletionRoutes(db){return async({path,req,session,json,readJson})=>{
 const match=path.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]{1,100})\/(deletion-preview|actions)$/);if(!match)return false;
 if(match[2]==='actions'&&req.method!=='POST')return false;
 if(match[2]==='deletion-preview'&&req.method!=='GET')return false;
 if(!session){json(401,{error:'Login required'});return true;}
 try{
  if(match[2]==='deletion-preview'){assertActor(db,session);json(200,preview(db,session.user_id,match[1]));return true;}
  const data=await readJson(16384);
  // Preserve legacy reset/suspension/restore routes when new role powers are held.
  if(data?.action!=='delete-permanently')return false;
  assertActor(db,session);
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!['action','expectedSnapshot','confirmIrreversible','scope','confirmUsername','reason'].includes(key))||data.confirmIrreversible!==true||data.scope!==scope||typeof data.expectedSnapshot!=='string'||!/^[a-f0-9]{64}$/.test(data.expectedSnapshot)||typeof data.confirmUsername!=='string'||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>500||/[\u0000-\u001f\u007f]/.test(data.reason))throw fail(400,'Permanent deletion preview and explicit confirmation required');
  db.exec('BEGIN IMMEDIATE');try{
   assertActor(db,session);const current=preview(db,session.user_id,match[1]);
   if(current.target.username!==data.confirmUsername)throw fail(400,'Account confirmation required');
   if(!current.allowed)throw fail(409,'Account has protected or shared dependencies');
   if(current.expectedSnapshot!==data.expectedSnapshot)throw fail(409,'Account changed. Preview deletion again.');
   const uid=current.target.id;
   const ownedClients=rows(db,'oauth_manual_clients','owner_id=?',uid).map(row=>row.client_id);
   if(exists(db,'integration_proposals'))db.prepare('DELETE FROM integration_proposals WHERE user_id=? OR grant_id IN (SELECT id FROM oauth_grants WHERE user_id=?)').run(uid,uid);
   for(const table of ['oauth_codes','oauth_grants','sessions','password_changes','account_profiles','account_status','files','workspaces','site_role_memberships'])if(exists(db,table))db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(uid);
   for(const client of ownedClients){for(const table of ['oauth_requests','oauth_callback_mismatches'])if(exists(db,table))db.prepare(`DELETE FROM ${table} WHERE client_id=?`).run(client);db.prepare('DELETE FROM oauth_manual_clients WHERE client_id=?').run(client);db.prepare('DELETE FROM oauth_clients WHERE id=?').run(client);}
   db.prepare('DELETE FROM users WHERE id=?').run(uid);
   db.prepare('INSERT INTO admin_audit(id,actor_id,target_id,action,reason,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),session.user_id,uid,'delete-permanently',data.reason.trim(),Date.now());
   db.exec('COMMIT');json(200,{ok:true,permanent:true});return true;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }catch(error){json(error.status||500,{error:error.status?error.message:'Permanent deletion failed'});return true;}
};}
