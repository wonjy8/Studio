import {createHash,randomUUID} from 'node:crypto';
const has=(db,table)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
const run=(db,table,sql,...args)=>has(db,table)?db.prepare(sql).run(...args):null;
const all=(db,table,where='',...args)=>has(db,table)?db.prepare(`SELECT * FROM ${table}${where?' WHERE '+where:''}`).all(...args):[];
export function setupCompleteDeletion(db){db.exec('CREATE TABLE IF NOT EXISTS inventory_history_redactions(kind TEXT NOT NULL,record_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(kind,record_id))');}
function snapshot(db,actor,target){
 const tokens=new Set([target]);const include=(table,where,...args)=>{const rows=all(db,table,where,...args);for(const row of rows)for(const key of ['id','client_id','grant_id','org_id','organization_id','equipment_id','contact_id'])if(typeof row[key]==='string')tokens.add(row[key]);return rows;};
 for(const table of ['files','contacts','reference_library','oauth_grants','google_sheet_links'])include(table,'user_id=?',target);
 include('oauth_manual_clients','owner_id=?',target);for(const row of all(db,'oauth_grants'))if(tokens.has(row.client_id))tokens.add(row.id);include('inventory_organizations','owner_id=?',target);include('inventory_memberships','user_id=?',target);include('equipment_items','owner_id=?',target);
 for(const row of all(db,'contact_equipment'))if(tokens.has(row.contact_id))tokens.add(row.id);
 for(const row of all(db,'inventory_loan_lines'))if(tokens.has(row.equipment_id)){tokens.add(row.id);tokens.add(row.loan_id);}
 for(const row of all(db,'inventory_loans','actor_id=?',target))tokens.add(row.id);for(const row of all(db,'inventory_loan_lines'))if(tokens.has(row.loan_id)){tokens.add(row.id);tokens.add(row.equipment_id);}
 for(const row of all(db,'inventory_returns'))if(row.actor_id===target||tokens.has(row.loan_id)){tokens.add(row.id);tokens.add(row.loan_id);}
 const hash=createHash('sha256');hash.update(JSON.stringify([actor,target,'complete-v2']));
 for(const {name}of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'connection_diagnostics' ORDER BY name").all()){
  hash.update(name);for(const row of db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').iterate()){
   if(name==='files'&&row.user_id!==target)continue;const value=JSON.stringify(row,(_key,value)=>value instanceof Uint8Array?{bytes:value.byteLength,hash:createHash('sha256').update(value).digest('hex')}:value);
   if(name==='site_settings'||[...tokens].some(token=>value.includes(token)))hash.update(value);
  }
 }return hash.digest('hex');
}

export function completeDeletionPreview(db,actorId,uid){
 const target=db.prepare('SELECT id,username FROM users WHERE id=?').get(uid);if(!target)throw Object.assign(Error('Account not found'),{status:404});
 target.deleted=Boolean(db.prepare('SELECT deleted_at FROM account_status WHERE user_id=?').get(uid)?.deleted_at);
 const highest=db.prepare("SELECT value FROM site_settings WHERE key='super_admin_user_id'").get()?.value,blockers=[];
 if(uid===actorId)blockers.push({kind:'self_account',count:1});if(uid===highest)blockers.push({kind:'highest_protected',count:1});
 const count=(table,key)=>all(db,table,key+'=?',uid).length;
 const impact={projects:all(db,'workspaces','user_id=?',uid).reduce((sum,row)=>{const s=JSON.parse(row.body);return sum+(s.project.placeholder?0:1)+(s.projects?.length||0);},0),files:count('files','user_id'),fileBytes:all(db,'files','user_id=?',uid).reduce((sum,f)=>sum+f.bytes.byteLength,0),profile:count('account_profiles','user_id')>0,sessions:count('sessions','user_id'),connections:count('oauth_grants','user_id')+count('google_accounts','user_id'),equipment:all(db,'equipment_items','owner_id=?',uid).filter(row=>db.prepare('SELECT ownership FROM inventory_metadata WHERE equipment_id=?').get(row.id)?.ownership!=='organization').length,contacts:count('contacts','user_id'),references:count('reference_library','user_id'),organizations:count('inventory_organizations','owner_id')};
 return {target,allowed:!blockers.length,blockers,impact,scope:'account-and-private-data',deletionMode:'complete',retainedHistory:{legacyDeletionAudit:0},expectedSnapshot:snapshot(db,actorId,uid)};
}
export function purgeCompleteAccount(db,actorId,uid){
 const equipment=new Set(all(db,'equipment_items','owner_id=?',uid).filter(item=>db.prepare('SELECT ownership FROM inventory_metadata WHERE equipment_id=?').get(item.id)?.ownership!=='organization').map(item=>item.id));
 const contacts=new Set(all(db,'contacts','user_id=?',uid).map(row=>row.id)),contactGear=new Set(all(db,'contact_equipment').filter(row=>contacts.has(row.contact_id)).map(row=>row.id)),libraries=new Set(all(db,'reference_library','user_id=?',uid).map(row=>row.id)),files=new Set(all(db,'files','user_id=?',uid).map(row=>row.id));
 const fileReference=value=>typeof value==='string'&&[...files].some(id=>value.includes('/api/files/'+id)||value.includes('/api/files/'+encodeURIComponent(id)));
 // Keep independent organization assets; the representative takes administrative custody.
 for(const org of all(db,'inventory_organizations','owner_id=?',uid)){
  db.prepare('UPDATE inventory_organizations SET owner_id=? WHERE id=?').run(actorId,org.id);
  db.prepare("INSERT INTO inventory_memberships(org_id,user_id,role,active) VALUES(?,?,'owner',1) ON CONFLICT(org_id,user_id) DO UPDATE SET role='owner',active=1").run(org.id,actorId);
  run(db,'inventory_org_settings','UPDATE inventory_org_settings SET revision=revision+1 WHERE org_id=?',org.id);
 }
 for(const member of all(db,'inventory_memberships',"user_id=? AND role='owner' AND active=1",uid))if(!db.prepare("SELECT 1 FROM inventory_memberships WHERE org_id=? AND user_id<>? AND role='owner' AND active=1").get(member.org_id,uid))db.prepare("INSERT INTO inventory_memberships VALUES(?,?,'owner',1) ON CONFLICT(org_id,user_id) DO UPDATE SET role='owner',active=1").run(member.org_id,actorId);
 for(const row of all(db,'equipment_items','owner_id=?',uid))if(!equipment.has(row.id)){db.prepare('UPDATE equipment_items SET owner_id=? WHERE id=?').run(actorId,row.id);db.prepare('UPDATE inventory_metadata SET revision=revision+1 WHERE equipment_id=?').run(row.id);}
 // Erase private equipment loan lines without changing unrelated stock/return arithmetic.
 for(const line of all(db,'inventory_loan_lines'))if(equipment.has(line.equipment_id)){
  db.prepare('DELETE FROM inventory_return_lines WHERE line_id=?').run(line.id);db.prepare('DELETE FROM inventory_loan_lines WHERE id=?').run(line.id);
 }
 for(const event of all(db,'inventory_returns')){
  if(!db.prepare('SELECT 1 FROM inventory_return_lines WHERE return_id=?').get(event.id)){db.prepare('DELETE FROM inventory_returns WHERE id=?').run(event.id);run(db,'inventory_history_redactions',"DELETE FROM inventory_history_redactions WHERE kind='return' AND record_id=?",event.id);}
  else if(event.actor_id===uid){db.prepare('UPDATE inventory_returns SET actor_id=? WHERE id=?').run(actorId,event.id);db.prepare("INSERT OR REPLACE INTO inventory_history_redactions VALUES('return',?,?)").run(event.id,Date.now());}
 }
 for(const loan of all(db,'inventory_loans')){
  if(!db.prepare('SELECT 1 FROM inventory_loan_lines WHERE loan_id=?').get(loan.id)){db.prepare('DELETE FROM inventory_loan_numbers WHERE loan_id=?').run(loan.id);db.prepare('DELETE FROM inventory_loans WHERE id=?').run(loan.id);run(db,'inventory_history_redactions',"DELETE FROM inventory_history_redactions WHERE kind='loan' AND record_id=?",loan.id);}
  else if(loan.actor_id===uid){db.prepare('UPDATE inventory_loans SET actor_id=? WHERE id=?').run(actorId,loan.id);db.prepare('DELETE FROM inventory_loan_numbers WHERE loan_id=?').run(loan.id);db.prepare("INSERT OR REPLACE INTO inventory_history_redactions VALUES('loan',?,?)").run(loan.id,Date.now());}
 }
 for(const line of all(db,'inventory_loan_lines')){const value=JSON.parse(line.snapshot);if(value.ownerId===uid){value.ownerId=actorId;db.prepare('UPDATE inventory_loan_lines SET snapshot=? WHERE id=?').run(JSON.stringify(value),line.id);}}
 for(const link of all(db,'equipment_links'))if(link.owner_id===uid||equipment.has(link.equipment_id))db.prepare('DELETE FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').run(link.owner_id,link.project_id,link.gear_id);
 const removedMembers=new Map();for(const link of all(db,'project_accounts','user_id=?',uid)){const key=JSON.stringify([link.owner_id,link.project_id]);if(!removedMembers.has(key))removedMembers.set(key,new Set());removedMembers.get(key).add(link.member_id);}
 // Detach deleted identity and files from surviving projects, keeping unrelated content intact.
 function cleanState(state,owner){for(const p of [state,...(state.projects||[])]){
  const memberIds=new Set(removedMembers.get(JSON.stringify([owner,p.project.id||'project-main']))||[]);
  for(const m of p.members||[])if(m.accountId===uid||contacts.has(m.contactId))memberIds.add(m.id);
  p.members=(p.members||[]).filter(m=>!memberIds.has(m.id));
  const gearIds=new Set((p.gear||[]).filter(g=>equipment.has(g.equipmentId)||contactGear.has(g.contactEquipmentId)).map(g=>g.id));p.gear=(p.gear||[]).filter(g=>!gearIds.has(g.id));
  for(const g of p.gear){if(memberIds.has(g.ownerMemberId)){delete g.ownerMemberId;g.owner='';}if(memberIds.has(g.assigneeMemberId)){delete g.assigneeMemberId;g.assignee='';}}
  const cameraIds=new Set((p.cameras||[]).filter(c=>gearIds.has(c.gearId)).map(c=>c.id));p.cameras=(p.cameras||[]).filter(c=>!cameraIds.has(c.id));
  p.layoutObjects=(p.layoutObjects||[]).filter(o=>!gearIds.has(o.gearId)&&!memberIds.has(o.memberId));
  p.refs=(p.refs||[]).filter(r=>!libraries.has(r.libraryId));for(const ref of p.refs){if(ref.images)ref.images=ref.images.filter(path=>!fileReference(path));if(ref.files)ref.files=ref.files.filter(id=>!files.has(id));}for(const camera of p.cameras)camera.refs=camera.refs.filter(id=>p.refs.some(ref=>ref.id===id));
  for(const content of p.contents||[]){if(files.has(content.scriptFile)){delete content.scriptFile;content.script=false;}if(content.cameraIds)content.cameraIds=content.cameraIds.filter(id=>!cameraIds.has(id));if(content.configuration){const c=content.configuration;c.memberIds=c.memberIds.filter(id=>!memberIds.has(id));c.gearIds=c.gearIds.filter(id=>!gearIds.has(id));c.cameras=c.cameras.filter(camera=>!gearIds.has(camera.gearId));for(const camera of c.cameras)camera.refs=camera.refs.filter(id=>p.refs.some(ref=>ref.id===id));c.layoutObjects=c.layoutObjects.filter(item=>!gearIds.has(item.gearId)&&!memberIds.has(item.memberId));}}
  for(const id of memberIds){db.prepare('UPDATE equipment_links SET owner_member_id=NULL WHERE owner_id=? AND project_id=? AND owner_member_id=?').run(owner,p.project.id||'project-main',id);db.prepare('UPDATE equipment_links SET assignee_member_id=NULL WHERE owner_id=? AND project_id=? AND assignee_member_id=?').run(owner,p.project.id||'project-main',id);db.prepare("UPDATE equipment_project_scope SET owner_member_id=NULL,owner_name='' WHERE project_owner_id=? AND project_id=? AND owner_member_id=?").run(owner,p.project.id||'project-main',id);}
  for(const id of memberIds)for(const team of all(db,'project_teams','owner_id=? AND project_id=?',owner,p.project.id||'project-main'))db.prepare('DELETE FROM project_team_members WHERE team_id=? AND member_id=?').run(team.id,id);
 }return scrub(state);}
 function scrub(value,key=''){
  if(Array.isArray(value))return value.filter(v=>!fileReference(v)).map(v=>scrub(v));
  if(value&&typeof value==='object'){for(const field of Object.keys(value)){const v=value[field];if(['accountId','ownerId','ownerAccountId','userId','equipmentOwnerKey'].includes(field)&&v===uid)delete value[field];else if(fileReference(v))value[field]='';else value[field]=scrub(v,field);}return value;}return value;
 }
 for(const row of all(db,'workspaces'))if(row.user_id!==uid){const before=row.body,body=JSON.stringify(cleanState(JSON.parse(before),row.user_id));if(body!==before)db.prepare('UPDATE workspaces SET body=?,revision=revision+1 WHERE user_id=?').run(body,row.user_id);}
 for(const row of all(db,'contacts'))if(row.user_id!==uid){const body=JSON.parse(row.body);if(body.accountId===uid){delete body.accountId;db.prepare('UPDATE contacts SET body=?,revision=revision+1 WHERE id=?').run(JSON.stringify(body),row.id);}}
 run(db,'deleted_projects',"UPDATE deleted_projects SET deleted_by='deleted-account' WHERE deleted_by=? AND owner_id<>?",uid,uid);
 for(const table of ['deleted_projects','material_migration_backups'])for(const row of all(db,table))if((row.owner_id||row.user_id)!==uid){const body=JSON.stringify(cleanState(JSON.parse(row.body),row.owner_id||row.user_id));if(body!==row.body){if(table==='deleted_projects')db.prepare('UPDATE deleted_projects SET body=? WHERE owner_id=? AND project_id=? AND revision=?').run(body,row.owner_id,row.project_id,row.revision);else db.prepare('UPDATE material_migration_backups SET body=? WHERE user_id=? AND version=?').run(body,row.user_id,row.version);}}
 for(const row of all(db,'project_teams','owner_id=?',uid))db.prepare('DELETE FROM project_team_members WHERE team_id=?').run(row.id);
 for(const table of ['equipment_claims','equipment_project_grants','equipment_project_scope'])for(const row of all(db,table))if(equipment.has(row.equipment_id)||row.project_owner_id===uid||row.target_id===uid){if(table==='equipment_claims')db.prepare('DELETE FROM equipment_claims WHERE id=?').run(row.id);else if(table==='equipment_project_scope')db.prepare('DELETE FROM equipment_project_scope WHERE equipment_id=?').run(row.equipment_id);else db.prepare('DELETE FROM equipment_project_grants WHERE equipment_id=? AND project_owner_id=? AND project_id=?').run(row.equipment_id,row.project_owner_id,row.project_id);}
 for(const id of equipment){for(const table of ['inventory_serials','inventory_sheet_archives','inventory_metadata'])run(db,table,`DELETE FROM ${table} WHERE equipment_id=?`,id);db.prepare('DELETE FROM equipment_items WHERE id=?').run(id);}
 for(const invite of all(db,'inventory_invitations'))if(invite.user_id===uid||invite.inviter_id===uid){db.prepare('DELETE FROM inventory_site_invitations WHERE invitation_id=?').run(invite.id);db.prepare('DELETE FROM inventory_invitations WHERE id=?').run(invite.id);}
 run(db,'inventory_site_invitations','DELETE FROM inventory_site_invitations WHERE inviter_id=?',uid);
 for(const approval of all(db,'inventory_project_approvals','approved_by=? AND project_owner_id<>?',uid,uid)){db.prepare('UPDATE inventory_project_approvals SET approved_by=?,revision=revision+1 WHERE org_id=? AND project_owner_id=? AND project_id=?').run(actorId,approval.org_id,approval.project_owner_id,approval.project_id);run(db,'inventory_org_settings','UPDATE inventory_org_settings SET revision=revision+1 WHERE org_id=?',approval.org_id);}
 for(const [table,predicate]of [['project_accounts','owner_id=? OR user_id=?'],['project_teams','owner_id=?'],['contact_project_accounts','owner_id=? OR user_id=?'],['inventory_operators','user_id=?'],['inventory_memberships','user_id=?'],['inventory_project_approvals','project_owner_id=? OR approved_by=?'],['inventory_sequences','actor_id=?'],['inventory_loan_numbers','issuer_id=?'],['inventory_requests','actor_id=?'],['invitations','created_by=?'],['admin_audit','actor_id=? OR target_id=?'],['site_role_audit','actor_id=? OR target_id=?'],['admin_project_audit','actor_id=? OR owner_id=?']])run(db,table,`DELETE FROM ${table} WHERE ${predicate}`,...Array((predicate.match(/\?/g)||[]).length).fill(uid));
 // Revoke account-owned OAuth clients, including their other grants, before removing clients.
 const clients=all(db,'oauth_manual_clients','owner_id=?',uid).map(row=>row.client_id),grants=all(db,'oauth_grants').filter(row=>row.user_id===uid||clients.includes(row.client_id)).map(row=>row.id);
 for(const row of all(db,'integration_proposals'))if(row.user_id===uid||grants.includes(row.grant_id))db.prepare('DELETE FROM integration_proposals WHERE id=?').run(row.id);
 for(const client of clients){for(const table of ['oauth_grants','oauth_codes','oauth_requests','oauth_callback_mismatches','oauth_manual_clients'])run(db,table,`DELETE FROM ${table} WHERE client_id=?`,client);db.prepare('DELETE FROM oauth_clients WHERE id=?').run(client);}
 for(const table of ['scripture_version_verses','scripture_versions','scripture_annotations','scripture_notes','scripture_verses','scripture_bibles','document_library','deleted_projects','material_migration_backups','contacts','reference_library','rental_vendors','google_sheet_links','google_oauth_states','google_accounts','oauth_codes','oauth_grants','sessions','password_changes','account_profiles','account_status','files','workspaces','site_role_memberships'])run(db,table,`DELETE FROM ${table} WHERE ${table==='deleted_projects'?'owner_id':'user_id'}=?`,uid);
 run(db,'site_settings',"DELETE FROM site_settings WHERE value=? AND key IN ('site_role_first_login_user_id','admin_user_id')",uid);
 db.prepare('DELETE FROM users WHERE id=?').run(uid);
 db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(randomUUID(),actorId,'deleted-account','delete-permanently-complete','',Date.now());
}
