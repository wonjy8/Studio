// An operator-only existing-install transition. It never infers identity from
// usernames, ordering, sessions, first-login markers, or repository ownership.
import {createHash,randomUUID} from 'node:crypto';
import {privateBackup} from './account-migration.js';
import {setupSiteRoles} from './site-roles.js';
import {setupAdminProjects} from './admin-projects.js';
const exists=(db,name)=>Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
const settings=db=>Object.fromEntries(db.prepare('SELECT key,value FROM site_settings ORDER BY key').all().map(row=>[row.key,row.value]));
const failure=(code,message)=>Object.assign(Error(message),{code});
function validate(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['targetId','expectedLegacyAdminId','confirmUsername','reason','expectedSnapshot'].includes(key))||!['targetId','expectedLegacyAdminId'].every(key=>typeof input[key]==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(input[key]))||typeof input.confirmUsername!=='string'||!input.confirmUsername||input.confirmUsername.length>64||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||/[\u0000-\u001f\u007f]/.test(input.reason))throw failure('INVALID_INPUT','Exact identity, confirmation and bounded reason required');}
function verifiedDesignation(db,uid){
 const required={site_role_memberships:['user_id','role','revision'],site_role_audit:['id','actor_id','target_id','action','reason','revision','actor_role','created_at'],admin_project_audit:['id','actor_id','actor_grade','owner_id','project_id','operation','revision','reason','created_at']};
 for(const [table,names] of Object.entries(required)){if(!exists(db,table))return false;const columns=db.prepare('PRAGMA table_info('+table+')').all().map(column=>column.name);if(!names.every(column=>columns.includes(column)))return false;}
 return Boolean(db.prepare("SELECT id FROM site_role_audit WHERE actor_id=? AND target_id=? AND action IN ('designate-highest-existing','bootstrap-highest') AND actor_role='super_admin' AND revision>=1 LIMIT 1").get(uid,uid));
}
function snapshot(db,input){const hash=createHash('sha256');for(const value of [input.targetId,input.expectedLegacyAdminId,input.confirmUsername,input.reason.trim()])hash.update(JSON.stringify(value));
 for(const table of ['users','site_settings','account_status','password_changes','site_role_memberships','site_role_audit']){hash.update(table);if(exists(db,table)){hash.update(db.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=?').get(table).sql);hash.update(JSON.stringify(db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()));}else hash.update('absent');}return hash.digest('hex');}
export function planSiteRoleTransition(db,input){validate(input);const current=settings(db),target=db.prepare('SELECT id,username FROM users WHERE id=?').get(input.targetId),blockers=[];const block=kind=>blockers.push(kind);
 if(input.targetId!==input.expectedLegacyAdminId||current.admin_user_id!==input.expectedLegacyAdminId)block('legacy_identity_mismatch');if(!target)block('target_missing');else if(target.username!==input.confirmUsername)block('username_confirmation_mismatch');
 const state=exists(db,'account_status')&&db.prepare('SELECT * FROM account_status WHERE user_id=?').get(input.targetId);if(state&&(state.deleted_at!=null||(state.suspended_until&&state.suspended_until>Date.now())))block('target_inactive');if(exists(db,'password_changes')&&db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(input.targetId))block('password_change_required');
 if(Object.hasOwn(current,'super_admin_user_id')&&current.super_admin_user_id!==input.targetId)block('highest_identity_conflict');if(current.super_admin_user_id===input.targetId&&!verifiedDesignation(db,input.targetId))block('highest_designation_unverified');if(Object.hasOwn(current,'site_role_first_login_user_id')&&current.site_role_first_login_user_id!==input.targetId)block('first_login_identity_conflict');
 return {target:target?{id:target.id,username:target.username}:null,legacyAdminId:current.admin_user_id||null,allowed:blockers.length===0,blockers,alreadyApplied:blockers.length===0&&current.super_admin_user_id===input.targetId,expectedSnapshot:snapshot(db,input),activationRequired:'STUDIO_SITE_ROLE_MANAGEMENT=enabled and an explicit restart; this tool does not edit deployment configuration.'};
}
export async function applySiteRoleTransition(db,dir,input,{backup=privateBackup}={}){
 validate(input);if(typeof input.expectedSnapshot!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedSnapshot))throw failure('SNAPSHOT_REQUIRED','Supply the exact dry-run expectedSnapshot');
 const before=planSiteRoleTransition(db,input);if(!before.allowed)throw failure('TRANSITION_BLOCKED','Existing-install highest designation is blocked');if(before.alreadyApplied)return {ok:true,alreadyApplied:true,activationRequired:before.activationRequired};if(before.expectedSnapshot!==input.expectedSnapshot)throw failure('SNAPSHOT_CHANGED','Identity or role state changed; repeat the read-only plan');
 // The SQLite online backup includes committed WAL data and is verified before
 // any additive schema, identity setting or audit writes. A failed backup aborts.
 await backup(db,dir);
 db.exec('BEGIN IMMEDIATE');try{
  const current=planSiteRoleTransition(db,input);if(!current.allowed||current.expectedSnapshot!==input.expectedSnapshot)throw failure('SNAPSHOT_CHANGED','Identity or role state changed during backup; repeat the read-only plan');
  // Same additive setup routines as prepareSiteRoleSchema, inside this single
  // transition transaction rather than its separate asynchronous backup wrapper.
  setupSiteRoles(db);setupAdminProjects(db);for(const table of ['site_role_memberships','site_role_audit','admin_project_audit'])if(!exists(db,table))throw failure('SCHEMA_INCOMPLETE','Site role schema incomplete');
  db.prepare("INSERT INTO site_settings(key,value) VALUES('super_admin_user_id',?)").run(input.targetId);
  db.prepare('INSERT INTO site_role_audit(id,actor_id,target_id,action,reason,revision,actor_role,created_at) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),input.targetId,input.targetId,'designate-highest-existing',input.reason.trim(),1,'super_admin',Date.now());
  db.exec('COMMIT');return {ok:true,alreadyApplied:false,activationRequired:current.activationRequired};
 }catch(error){db.exec('ROLLBACK');throw error;}
}
