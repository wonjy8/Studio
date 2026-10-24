// Representatives use complete account deletion; delegated administrators and
// self-deletion retain the narrower dependency-protected policy.
import {setupCompleteDeletion,completeDeletionPreview,purgeCompleteAccount} from './account-complete-deletion.js';
import {createHash,randomUUID} from 'node:crypto';
import {siteCapabilities,siteRole} from './site-roles.js';
import {representativeMemberId} from './project-representative.js';
import {verifyPassword} from './auth.js';
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
const privateTables=[['google_read_account_states','user_id=?'],['google_read_additional_accounts','user_id=?'],['google_read_account_epochs','user_id=?'],['google_read_account_revocations','user_id=?'],['document_file_uploads','user_id=?'],['document_files','user_id=?'],['scripture_version_verses','user_id=?'],['scripture_versions','user_id=?'],['scripture_notes','user_id=?'],['scripture_verses','user_id=?'],['scripture_bibles','user_id=?'],['document_library','user_id=?'],['deleted_projects','owner_id=?'],['contact_project_accounts','owner_id=?'],['material_migration_backups','user_id=?'],['reference_library','user_id=?'],['reference_boards','user_id=?'],['contacts','user_id=?'],['rental_vendors','user_id=?'],['google_sheet_links','user_id=?'],['google_oauth_states','user_id=?'],['google_accounts','user_id=?'],['users','id=?'],['password_changes','user_id=?'],['account_profiles','user_id=?'],['account_status','user_id=?'],['sessions','user_id=?'],['workspaces','user_id=?'],['files','user_id=?'],['oauth_codes','user_id=?'],['oauth_grants','user_id=?'],['integration_proposals','user_id=?'],['oauth_manual_clients','owner_id=?'],['site_role_memberships','user_id=?']];
const parameters=(predicate,uid)=>Array((predicate.match(/\?/g)||[]).length).fill(uid);
const rows=(db,table,predicate,uid)=>exists(db,table)?db.prepare(`SELECT * FROM ${table} WHERE ${predicate} ORDER BY rowid`).all(...parameters(predicate,uid)):[];
function active(db,uid){const row=exists(db,'account_status')&&db.prepare('SELECT * FROM account_status WHERE user_id=?').get(uid);return !row||(row.deleted_at==null&&(!row.suspended_until||row.suspended_until<=Date.now()));}
const setting=(db,key)=>db.prepare('SELECT value FROM site_settings WHERE key=?').get(key)?.value;
function configured(db){const highest=setting(db,'super_admin_user_id');return Boolean(highest&&siteCapabilities(db,highest).canManageSiteRoles);}
function rawAdmin(db,uid){return exists(db,'site_role_memberships')&&db.prepare("SELECT user_id FROM site_role_memberships WHERE user_id=? AND role='admin'").get(uid);}
function targetProtection(db,actorId,uid,self){
 const highest=setting(db,'super_admin_user_id'),legacy=setting(db,'admin_user_id');
 if(uid===highest)return 'highest_protected';
 if(legacy===uid&&legacy!==highest)return 'legacy_admin_identity_unverified';
 if(rawAdmin(db,uid)){if(self)return 'admin_role_requires_removal';if(siteRole(db,actorId)!=='super_admin')return 'highest_authority_required';}
 return null;
}
export function selfDeletionCapability(db,uid){return Boolean(uid&&configured(db)&&active(db,uid)&&db.prepare('SELECT id FROM users WHERE id=?').get(uid)&&!targetProtection(db,uid,uid,true)&&setting(db,'site_role_first_login_user_id')!==uid);}
function assertSession(db,session){if(!session?.user_id||!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,session.user_id,Date.now()))throw fail(401,'Session changed. Sign in again');if(!active(db,session.user_id))throw fail(403,'Account unavailable');if(exists(db,'password_changes')&&db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(session.user_id))throw fail(403,'Password change required');}
function assertActor(db,session){assertSession(db,session);if(!siteCapabilities(db,session.user_id).canDeleteAccounts)throw fail(403,'Administrator required');}
function assertSelf(db,session,{previewOnly=false}={}){assertSession(db,session);if(!configured(db))throw fail(403,'Account deletion is not configured');if(!previewOnly&&!selfDeletionCapability(db,session.user_id))throw fail(403,'Administrator role must be removed by the highest administrator before self deletion');}

function references(value,uid,filePaths,key=''){
 if(typeof value==='string')return (['accountId','ownerId','ownerAccountId','userId'].includes(key)&&value===uid)||filePaths.some(path=>value.includes(path));
 if(Array.isArray(value))return value.some(entry=>references(entry,uid,filePaths));
 return value&&typeof value==='object'?Object.entries(value).some(([field,entry])=>references(entry,uid,filePaths,field)):false;
}
function automaticRepresentativeLinks(db,uid){
 const representative=setting(db,'super_admin_user_id');
 return rows(db,'project_accounts','owner_id=?',uid).filter(row=>row.user_id===representative&&row.member_id===representativeMemberId(uid,row.project_id,representative));
}
function automaticRepresentativeEquipmentLinks(db,uid){
 const links=automaticRepresentativeLinks(db,uid),projects=new Set(links.map(link=>link.project_id));
 const representative=setting(db,'super_admin_user_id');
 return rows(db,'equipment_links','owner_id=?',uid).filter(link=>{
  const prefix='auto-'+link.equipment_id,automatic=link.gear_id===prefix||(link.gear_id.startsWith(prefix+'-')&&/^[1-9][0-9]*$/.test(link.gear_id.slice(prefix.length+1)));
  if(!projects.has(link.project_id)||!automatic)return false;
  const equipment=db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(link.equipment_id),meta=exists(db,'inventory_metadata')?db.prepare('SELECT ownership FROM inventory_metadata WHERE equipment_id=?').get(link.equipment_id):null;
  return equipment?.owner_id===representative&&(!meta||meta.ownership==='personal');
 });
}
function preview(db,actorId,uid,{self=false}={}){
 if(!self&&siteRole(db,actorId)==='super_admin')return completeDeletionPreview(db,actorId,uid);
 const target=db.prepare('SELECT id,username FROM users WHERE id=?').get(uid);if(!target)throw fail(404,'Account not found');
 const status=exists(db,'account_status')&&db.prepare('SELECT deleted_at FROM account_status WHERE user_id=?').get(uid);target.deleted=Boolean(status&&status.deleted_at!=null);
 const retainedHistory={legacyDeletionAudit:0};
 const automaticEquipmentLinks=new Set(automaticRepresentativeEquipmentLinks(db,uid).map(row=>JSON.stringify([row.owner_id,row.project_id,row.gear_id,row.equipment_id])));
 const automaticLinks=new Set(automaticRepresentativeLinks(db,uid).map(row=>JSON.stringify([row.owner_id,row.project_id,row.user_id,row.member_id])));
 const blockers=[],hash=createHash('sha256');const evidence=[];const block=(kind,count)=>{if(count)blockers.push({kind,count});};
 block('self_account',!self&&actorId===uid?1:0);const protection=targetProtection(db,actorId,uid,self);if(protection)block(protection,1);
 for(const [table,predicate] of relations){const found=rows(db,table,predicate,uid);
  // Only another actor's legacy soft-deletion event may survive this narrow
  // purge. Actor references and every other history type still fail closed.
  const retained=table==='admin_audit'&&target.deleted?found.filter(row=>row.target_id===uid&&row.action==='delete'&&row.actor_id!==uid):[];
  if(table==='admin_audit')retainedHistory.legacyDeletionAudit=retained.length;
  const automaticCount=table==='project_accounts'?found.filter(row=>automaticLinks.has(JSON.stringify([row.owner_id,row.project_id,row.user_id,row.member_id]))).length:table==='equipment_links'?found.filter(row=>automaticEquipmentLinks.has(JSON.stringify([row.owner_id,row.project_id,row.gear_id,row.equipment_id]))).length:0;
  block(table,found.length-retained.length-automaticCount);if(['site_role_audit','admin_project_audit'].includes(table)&&found.length){blockers.at(-1).reason='Retained authority or project audit references require a separate reviewed retention policy';}evidence.push([table,found]);
 }
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
 const filePaths=[...rows(db,'files','user_id=?',uid),...rows(db,'document_files','user_id=?',uid)].flatMap(file=>['/api/files/'+file.id,'/api/files/'+encodeURIComponent(file.id),'/api/document-files/'+file.id]);
 for(const workspace of db.prepare('SELECT user_id,revision,body FROM workspaces WHERE user_id<>? ORDER BY user_id').all(uid)){
  let parsed;try{parsed=JSON.parse(workspace.body);}catch{block('unreadable_foreign_workspace',1);evidence.push(['unreadable_foreign_workspace',workspace]);continue;}
  if(references(parsed,uid,filePaths)){block('foreign_workspace_reference',1);evidence.push(['foreign_workspace_reference',workspace]);}
 }
 // Hash is opaque: private values, credential hashes and file bytes never leave this service.
 for(const entry of [actorId,target,blockers,evidence])hash.update(JSON.stringify(entry,(_key,value)=>value instanceof Uint8Array?{byteLength:value.byteLength,sha256:createHash('sha256').update(value).digest('hex')}:value));
 const privateFiles=[...rows(db,'files','user_id=?',uid),...rows(db,'document_files','user_id=?',uid)],privateWorkspaces=rows(db,'workspaces','user_id=?',uid);
 const impact={projects:privateWorkspaces.reduce((count,row)=>{try{const state=JSON.parse(row.body);return count+1+(Array.isArray(state.projects)?state.projects.length:0);}catch{return count;}},0),files:privateFiles.length,fileBytes:privateFiles.reduce((count,row)=>count+row.bytes.byteLength,0),sessions:rows(db,'sessions','user_id=?',uid).length,connections:rows(db,'oauth_grants','user_id=?',uid).length+rows(db,'google_accounts','user_id=?',uid).length+rows(db,'google_read_accounts','user_id=?',uid).length+rows(db,'google_read_additional_accounts','user_id=?',uid).length,profile:rows(db,'account_profiles','user_id=?',uid).length>0};
 return {target,allowed:blockers.length===0,blockers,scope,impact,retainedHistory,expectedSnapshot:hash.digest('hex'),warning:'Permanent deletion removes this account and its private data. It cannot be restored in the app. Legacy deletion audit records remain unchanged; existing backups retain their separate retention policy.'};
}
function confirmed(data,self){const fields=self?['currentPassword','expectedSnapshot','confirmIrreversible','scope','confirmUsername']:['action','expectedSnapshot','confirmIrreversible','scope','confirmUsername','reason'];if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!fields.includes(key))||data.confirmIrreversible!==true||data.scope!==scope||typeof data.expectedSnapshot!=='string'||!/^[a-f0-9]{64}$/.test(data.expectedSnapshot)||typeof data.confirmUsername!=='string'||(self?(typeof data.currentPassword!=='string'||!data.currentPassword||data.currentPassword.length>256):(data.reason!==undefined&&(typeof data.reason!=='string'||data.reason.length>500||/[\u0000-\u001f\u007f]/.test(data.reason)))))throw fail(400,'Permanent deletion preview and explicit confirmation required');}
// One destructive core for both entry points. Caller holds BEGIN IMMEDIATE and
// has rechecked actor authority, target policy, credentials and exact preview.
function purge(db,actorId,uid,reason){
 for(const link of automaticRepresentativeEquipmentLinks(db,uid))db.prepare('DELETE FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=? AND equipment_id=?').run(link.owner_id,link.project_id,link.gear_id,link.equipment_id);
 for(const link of automaticRepresentativeLinks(db,uid))db.prepare('DELETE FROM project_accounts WHERE owner_id=? AND project_id=? AND user_id=? AND member_id=?').run(link.owner_id,link.project_id,link.user_id,link.member_id);
 const ownedClients=rows(db,'oauth_manual_clients','owner_id=?',uid).map(row=>row.client_id);
 if(exists(db,'integration_proposals'))db.prepare('DELETE FROM integration_proposals WHERE user_id=? OR grant_id IN (SELECT id FROM oauth_grants WHERE user_id=?)').run(uid,uid);
 if(exists(db,'deleted_projects'))db.prepare('DELETE FROM deleted_projects WHERE owner_id=?').run(uid);
 if(exists(db,'contact_project_accounts'))db.prepare('DELETE FROM contact_project_accounts WHERE owner_id=?').run(uid);
 for(const table of ['google_read_account_states','google_read_additional_accounts','google_read_account_epochs','google_read_account_revocations','document_file_uploads','document_files','material_migration_backups','contacts','reference_boards','reference_library','rental_vendors','google_sheet_links','google_oauth_states','google_accounts','oauth_codes','oauth_grants','sessions','password_changes','account_profiles','account_status','files','workspaces','site_role_memberships'])if(exists(db,table))db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(uid);
 for(const client of ownedClients){for(const table of ['oauth_requests','oauth_callback_mismatches'])if(exists(db,table))db.prepare(`DELETE FROM ${table} WHERE client_id=?`).run(client);db.prepare('DELETE FROM oauth_manual_clients WHERE client_id=?').run(client);db.prepare('DELETE FROM oauth_clients WHERE id=?').run(client);}
 db.prepare('DELETE FROM users WHERE id=?').run(uid);
 db.prepare('INSERT INTO admin_audit(id,actor_id,target_id,action,reason,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),actorId,uid,'delete-permanently',reason,Date.now());
}
function commitDeletion(db,session,uid,data,{self=false,passwordHash}={}){
 db.exec('BEGIN IMMEDIATE');try{
  if(self){assertSelf(db,session);if(db.prepare('SELECT password FROM users WHERE id=?').get(uid)?.password!==passwordHash)throw fail(409,'Password changed. Sign in and preview deletion again');}else assertActor(db,session);
  const current=preview(db,session.user_id,uid,{self});if(current.target.username!==data.confirmUsername)throw fail(400,'Account confirmation required');if(!current.allowed)throw fail(409,'Account has protected or shared dependencies');if(current.expectedSnapshot!==data.expectedSnapshot)throw fail(409,'Account changed. Preview deletion again.');
  if(current.deletionMode==='complete')purgeCompleteAccount(db,session.user_id,uid);else purge(db,session.user_id,uid,self?'self-delete':(data.reason||'').trim());db.exec('COMMIT');return {ok:true,permanent:true};
 }catch(error){db.exec('ROLLBACK');throw error;}
}
export function accountDeletionRoutes(db){setupCompleteDeletion(db);const attempts=new Map();return async({path,req,session,json,readJson,clearSessionCookie})=>{
 const self=path==='/api/account/deletion-preview'||path==='/api/account/delete',match=path.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]{1,100})\/(deletion-preview|actions)$/);if(!self&&!match)return false;
 if(self&&!(path==='/api/account/deletion-preview'&&req.method==='GET')&&!(path==='/api/account/delete'&&req.method==='POST')){json(404,{error:'Not found'});return true;}
 if(!self&&((match[2]==='actions'&&req.method!=='POST')||(match[2]==='deletion-preview'&&req.method!=='GET')))return false;
 if(!session){json(401,{error:'Login required'});return true;}
 try{
  const uid=self?session.user_id:match[1];
  if((self&&req.method==='GET')||(!self&&match[2]==='deletion-preview')){if(self)assertSelf(db,session,{previewOnly:true});else assertActor(db,session);json(200,preview(db,session.user_id,uid,{self}));return true;}
  const data=await readJson(16384);if(!self&&data?.action!=='delete-permanently')return false;
  if(!self){assertActor(db,session);confirmed(data,false);json(200,commitDeletion(db,session,uid,data));return true;}
  assertSelf(db,session);confirmed(data,true);
  const now=Date.now();for(const [id,record]of attempts)if(!record.inFlight&&record.until<=now)attempts.delete(id);
  const attempt=attempts.get(uid)||{count:0,until:now+15*60000,inFlight:false};if(attempt.inFlight||attempt.count>=5)throw fail(429,'Too many deletion attempts. Try again later');attempt.count++;attempt.inFlight=true;attempts.set(uid,attempt);
  try{const passwordHash=db.prepare('SELECT password FROM users WHERE id=?').get(uid)?.password;let verified=false;try{verified=Boolean(passwordHash&&await verifyPassword(data.currentPassword,passwordHash));}catch{}if(!verified)throw fail(403,'Current password rejected');const response=commitDeletion(db,session,uid,data,{self:true,passwordHash});clearSessionCookie?.();json(200,response);return true;}finally{attempt.inFlight=false;}
 }catch(error){json(error.status||500,{error:error.status?error.message:'Permanent deletion failed'});return true;}
};}

