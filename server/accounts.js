import {assertInventoryIdentityChange,getInventoryMetadata,bumpInventoryRevision} from './inventory.js';
import {applyCommands} from '../src/domain/commands.js';
import {reconcileEquipment,assertEquipmentCategory} from './equipment.js';
import {randomUUID} from 'node:crypto';
import {equipmentProjectAccess,equipmentProjectScope,equipmentSource} from './equipment-sharing.js';
import {orgCanManage} from './inventory-organizations.js';
import {isAdmin} from './invitations.js';
import {isProtectedSiteAccount,siteRole} from './site-roles.js';
import {token,hashPassword,verifyPassword} from './auth.js';
import {validPassword} from './password-policy.js';
import {readWorkspace,writeWorkspace} from './workspace-service.js';
export function accountActive(db,id){const s=db.prepare('SELECT * FROM account_status WHERE user_id=?').get(id);return !s||(!s.deleted_at&&(!s.suspended_until||s.suspended_until<=Date.now()));}
export function passwordChangeRequired(db,id){return Boolean(db.prepare('SELECT user_id FROM password_changes WHERE user_id=?').get(id));}
export function setupAccounts(db){db.exec(`
 CREATE TABLE IF NOT EXISTS password_changes(user_id TEXT PRIMARY KEY REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS account_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),name TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS account_status(user_id TEXT PRIMARY KEY REFERENCES users(id),suspended_until INTEGER,deleted_at INTEGER);
 CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,target_id TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS equipment_items(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,category TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS equipment_links(owner_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,gear_id TEXT NOT NULL,equipment_id TEXT NOT NULL REFERENCES equipment_items(id),owner_member_id TEXT,assignee_member_id TEXT,PRIMARY KEY(owner_id,project_id,gear_id),UNIQUE(owner_id,project_id,equipment_id));
 CREATE TABLE IF NOT EXISTS project_accounts(owner_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),member_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(owner_id,project_id,user_id));
 CREATE TABLE IF NOT EXISTS project_teams(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS project_team_members(team_id TEXT NOT NULL REFERENCES project_teams(id),member_id TEXT NOT NULL,PRIMARY KEY(team_id,member_id));
 `);}
const projects=state=>[state,...(state.projects||[])];
// Share only this project's explicitly supported production fields. Workspace roots
// also contain private projects/settings; cloning a root would cross that boundary.
export function sharedProjectProjection(p){
 const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>['string','number','boolean'].includes(typeof value?.[k])).map(k=>[k,value[k]]));
 const list=(key,fields)=>(p[key]||[]).map(value=>pick(value,fields));
 return {
  project:pick(p.project,['id','name','description','date','time','location','icon','color']),
  contents:list('contents',['id','name','date','time','location','status','completed']),
  members:list('members',['id','name','role','call']),
  gear:list('gear',['id','name','category','owner','assignee','status']),
  schedule:(p.schedule||[]).map(row=>row.filter(value=>typeof value==='string')),
  cameras:(p.cameras||[]).map(camera=>({...pick(camera,['id','name','role','operator','body','lens','x','y','gearId']),refs:[]})),
  layoutObjects:list('layoutObjects',['id','kind','name','x','y','rotation','width','height','shape','memberId','gearId','lightType','color','background']),
  refs:(p.refs||[]).map(ref=>({...pick(ref,['id','name','notes']),images:[]})),
  tasks:list('tasks',['id','name','completed','date','time','flagged'])
 };
}
export function linkedWorkspace(db,uid,state){for(const p of projects(state)){const pid=p.project.id||'project-main';for(const m of p.members)delete m.accountId;for(const link of db.prepare('SELECT a.member_id,a.user_id,u.username,p.name FROM project_accounts a JOIN users u ON u.id=a.user_id LEFT JOIN account_profiles p ON p.user_id=u.id WHERE a.owner_id=? AND a.project_id=?').all(uid,pid)){let m=p.members.find(m=>m.id===link.member_id);if(!m){m={id:link.member_id,name:link.name||link.username,role:'',call:''};p.members.push(m);}m.accountId=link.user_id;}}return state;}
export function accountRoutes(db){
 const revoke=id=>{db.prepare('DELETE FROM oauth_codes WHERE user_id=?').run(id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);db.prepare('UPDATE oauth_grants SET revoked=1 WHERE user_id=?').run(id);};
 return async({path,url,req,session,json,readJson})=>{
 if(!path.startsWith('/api/accounts')&&path!=='/api/account/profile'&&path!=='/api/account/password'&&!path.startsWith('/api/admin/')&&path!=='/api/shared-projects'&&!path.startsWith('/api/projects/')&&path!=='/api/equipment'&&!/^\/api\/equipment\/[A-Za-z0-9_-]+$/.test(path))return false;
 if(!session){json(401,{error:'Login required'});return true;}const uid=session.user_id;
 const fail=(status,error)=>{json(status,{error});return true;};
 if(path==='/api/account/profile'&&req.method==='PUT'){const data=await readJson(16384);if(!data||typeof data.name!=='string'||data.name.length>80||/[\u0000-\u001f\u007f]/.test(data.name))return fail(400,'Invalid account name');db.prepare('INSERT INTO account_profiles VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name').run(uid,data.name.trim());json(200,{ok:true,name:data.name.trim()});return true;}
 if(path==='/api/account/password'&&req.method==='POST'){const data=await readJson(16384);if(!data||typeof data.currentPassword!=='string'||data.currentPassword.length>256||!validPassword(data.password)||data.password===data.currentPassword)return fail(400,'Password policy');const user=db.prepare('SELECT password FROM users WHERE id=?').get(uid);if(!await verifyPassword(data.currentPassword,user.password))return fail(403,'Current password rejected');const password=await hashPassword(data.password);db.exec('BEGIN IMMEDIATE');try{if(!accountActive(db,uid)||!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,uid,Date.now())){db.exec('ROLLBACK');return fail(401,'Session changed. Sign in again');}const changed=db.prepare('UPDATE users SET password=? WHERE id=? AND password=?').run(password,uid,user.password);if(!changed.changes){db.exec('ROLLBACK');return fail(409,'Password changed. Sign in again');}db.prepare('DELETE FROM password_changes WHERE user_id=?').run(uid);revoke(uid);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}json(200,{ok:true,loginRequired:true});return true;}
 if(path.startsWith('/api/admin/')&&!isAdmin(db,uid))return fail(403,'Administrator required');
 if(path==='/api/shared-projects'&&req.method==='GET'){const shared=db.prepare('SELECT owner_id,project_id FROM project_accounts WHERE user_id=?').all(uid).flatMap(link=>{const p=projects(readWorkspace(db,link.owner_id).state).find(p=>(p.project.id||'project-main')===link.project_id);return p?[{ownerId:link.owner_id,projectId:link.project_id,name:p.project.name,icon:p.project.icon,color:p.project.color,readOnly:true}]:[];});json(200,{projects:shared});return true;}
 if(path==='/api/accounts'&&req.method==='GET'){
 const q=(url.searchParams.get('q')||'').trim();if(q.length<2||q.length>64){json(200,{accounts:[]});return true;}
 const escaped=q.replace(/[\\%_]/g,'\\$&');const accounts=db.prepare("SELECT u.id,u.username,COALESCE(p.name,'') AS name FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id LEFT JOIN account_status s ON s.user_id=u.id WHERE s.deleted_at IS NULL AND (s.suspended_until IS NULL OR s.suspended_until<=?) AND (u.username LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\') ORDER BY u.username LIMIT 20").all(Date.now(),`%${escaped}%`,`%${escaped}%`);json(200,{accounts});return true;}
 if(path==='/api/admin/users'&&req.method==='GET'){json(200,{users:db.prepare("SELECT u.id,u.username,COALESCE(p.name,'') name,s.suspended_until,s.deleted_at FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id LEFT JOIN account_status s ON s.user_id=u.id ORDER BY u.username").all().map(user=>({...user,siteRole:siteRole(db,user.id),protected:isProtectedSiteAccount(db,user.id)}))});return true;}
 if(path==='/api/admin/audit'&&req.method==='GET'){json(200,{events:db.prepare('SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT 100').all()});return true;}
 const admin=path.match(/^\/api\/admin\/users\/([^/]+)\/actions$/);
 if(admin&&req.method==='POST'){
 const data=await readJson(16384),id=admin[1],user=db.prepare('SELECT id,username FROM users WHERE id=?').get(id);
 if(!data||typeof data!=='object')return fail(400,'Invalid input');if(!user)return fail(404,'Account not found');if(id===uid||isProtectedSiteAccount(db,id))return fail(403,'Administrator account protected');
 if(data.action==='delete')return fail(400,'Permanent deletion preview required');
 if(db.prepare('SELECT deleted_at FROM account_status WHERE user_id=?').get(id)?.deleted_at!=null)return fail(409,'Deleted accounts cannot be restored or modified. Preview permanent deletion.');
 if(data.confirmUsername!==user.username||typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>500)return fail(400,'Confirmation and reason required');
 if(!['reset-password','suspend','restore'].includes(data.action))return fail(400,'Invalid action');
 if(data.action==='suspend'&&data.until!==null&&(!Number.isSafeInteger(data.until)||data.until<=Date.now()||data.until>Date.now()+366*86400000))return fail(400,'Invalid suspension period');
 let temporaryPassword,password;if(data.action==='reset-password'){temporaryPassword=`A!${token()}`;password=await hashPassword(temporaryPassword);}
 db.exec('BEGIN IMMEDIATE');try{
 if(!accountActive(db,uid)||!isAdmin(db,uid)){db.exec('ROLLBACK');return fail(403,'Administrator required');}
 if(!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,uid,Date.now())){db.exec('ROLLBACK');return fail(401,'Session changed. Sign in again');}
 if(passwordChangeRequired(db,uid)){db.exec('ROLLBACK');return fail(403,'Password change required');}
 if(id===uid||isProtectedSiteAccount(db,id)){db.exec('ROLLBACK');return fail(403,'Administrator account protected');}
 if(!db.prepare('SELECT id FROM users WHERE id=?').get(id)){db.exec('ROLLBACK');return fail(404,'Account not found');}
 if(db.prepare('SELECT deleted_at FROM account_status WHERE user_id=?').get(id)?.deleted_at!=null){db.exec('ROLLBACK');return fail(409,'Deleted accounts cannot be restored or modified. Preview permanent deletion.');}
 if(password){db.prepare('UPDATE users SET password=? WHERE id=?').run(password,id);db.prepare('INSERT OR IGNORE INTO password_changes VALUES(?)').run(id);}
 else {const until=data.action==='suspend'?(data.until===null?8640000000000000:data.until):null;db.prepare('INSERT INTO account_status VALUES(?,?,NULL) ON CONFLICT(user_id) DO UPDATE SET suspended_until=excluded.suspended_until').run(id,until);}
 revoke(id);db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(randomUUID(),uid,id,data.action,data.reason.trim(),Date.now());db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}json(200,{ok:true,...(temporaryPassword?{temporaryPassword}:{})});return true;}
 if(path==='/api/equipment'&&req.method==='POST'){
 const data=await readJson(16384);if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>2000||!['camera','lens','lighting','tripod','sd','audio','other'].includes(data.category))return fail(400,'Invalid equipment');const id=randomUUID();db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run(id,uid,data.name.trim(),data.category);json(201,{id,name:data.name.trim(),category:data.category});return true;}
 const equipmentEdit=path.match(/^\/api\/equipment\/([A-Za-z0-9_-]+)$/);if(equipmentEdit&&req.method==='PUT'){
 const data=await readJson(16384);if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>2000||!['camera','lens','lighting','tripod','sd','audio','other'].includes(data.category)||Object.keys(data).some(key=>!['name','category'].includes(key)))return fail(400,'Invalid equipment');
 db.exec('BEGIN IMMEDIATE');try{
  const item=db.prepare('SELECT * FROM equipment_items WHERE id=? AND owner_id=?').get(equipmentEdit[1],uid);if(!item){db.exec('ROLLBACK');return fail(404,'Equipment not found');}
  const metadata=getInventoryMetadata(db,item.id);if(equipmentProjectScope(db,item.id)||(metadata.ownership==='organization'&&!orgCanManage(db,uid,metadata.organizationId))){db.exec('ROLLBACK');return fail(403,'Inventory management permission required');}
  const values={name:data.name.trim(),category:data.category};assertInventoryIdentityChange(db,item.id,values);assertEquipmentCategory(db,uid,item.id,values.category);
  db.prepare('UPDATE equipment_items SET name=?,category=? WHERE id=? AND owner_id=?').run(values.name,values.category,item.id,uid);
  if(item.name!==values.name||item.category!==values.category)bumpInventoryRevision(db,item.id);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 json(200,{ok:true});return true;}

 const assignmentRoute=path.match(/^\/api\/projects\/([A-Za-z0-9_-]{1,80})\/equipment\/([A-Za-z0-9_-]{1,80})\/assignments$/);if(assignmentRoute&&req.method==='PUT'){
 const data=await readJson(16384),fields=['ownerMemberId','assigneeMemberId','owner','assignee'];
 if(!data||Object.keys(data).some(key=>!['revision','values'].includes(key))||!Number.isSafeInteger(data.revision)||!data.values||typeof data.values!=='object'||Array.isArray(data.values)||Object.keys(data.values).length!==4||fields.some(key=>!Object.hasOwn(data.values,key))||Object.keys(data.values).some(key=>!fields.includes(key))||['owner','assignee'].some(key=>typeof data.values[key]!=='string'||data.values[key].length>2000)||['ownerMemberId','assigneeMemberId'].some(key=>data.values[key]!==null&&typeof data.values[key]!=='string'))return fail(400,'Invalid equipment assignment');
 const current=readWorkspace(db,uid);if(data.revision!==current.revision)return fail(409,'Workspace changed. Reload before editing.');
 const [,pid,gearId]=assignmentRoute,p=projects(current.state).find(p=>(p.project.id||'project-main')===pid);if(!p||!p.gear.some(gear=>gear.id===gearId))return fail(404,'Equipment not found');
 const target=p.gear.find(g=>g.id===gearId);if(['member','organization'].includes(target.equipmentSource)&&(data.values.owner!==target.owner||data.values.ownerMemberId!==(target.ownerMemberId??null)))return fail(403,'Canonical owner cannot be changed from this project');
 let candidate;try{candidate=applyCommands(current.state,pid,[{operation:'update_equipment',entityId:gearId,values:data.values}]).state;}catch{return fail(400,'Invalid project member assignment');}
 db.exec('BEGIN IMMEDIATE');let result;try{db.prepare('UPDATE equipment_links SET owner_member_id=?,assignee_member_id=? WHERE owner_id=? AND project_id=? AND gear_id=?').run(data.values.ownerMemberId,data.values.assigneeMemberId,uid,pid,gearId);result=writeWorkspace(db,uid,candidate,data.revision);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 json(200,result);return true;
 }
 const equipLink=path.match(/^\/api\/projects\/([A-Za-z0-9_-]{1,80})\/equipment-links$/);if(equipLink&&req.method==='POST'){
 const data=await readJson(16384);if(!data||typeof data!=='object'||Array.isArray(data))return fail(400,'Invalid equipment link');
 db.exec('BEGIN IMMEDIATE');try{const current=readWorkspace(db,uid),pid=equipLink[1],p=projects(current.state).find(p=>(p.project.id||'project-main')===pid);if(!p){db.exec('ROLLBACK');return fail(404,'Project not found');}linkedWorkspace(db,uid,current.state);
 if([data.ownerMemberId,data.assigneeMemberId].some(id=>id!==undefined&&id!==null&&id!==''&&!p.members.some(m=>m.id===id)))throw Object.assign(Error('Invalid member link'),{status:400});
 let item,existing,id,scope;
 if(data.source==='manual'){
 if(typeof data.name!=='string'||!data.name.trim()||data.name.length>2000||!['camera','lens','lighting','tripod','sd','audio','other'].includes(data.category)||data.ownerName!==undefined&&(typeof data.ownerName!=='string'||data.ownerName.length>2000))throw Object.assign(Error('Invalid project equipment'),{status:400});
 item={id:randomUUID(),owner_id:uid,name:data.name.trim(),category:data.category};db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run(item.id,uid,item.name,item.category);db.prepare('INSERT INTO equipment_project_scope VALUES(?,?,?,?,?)').run(item.id,uid,pid,data.ownerMemberId||null,p.members.find(m=>m.id===data.ownerMemberId)?.name||data.ownerName||'');scope=true;
 }else{item=db.prepare('SELECT * FROM equipment_items WHERE id=?').get(data.equipmentId);if(!item||!equipmentProjectAccess(db,uid,pid,item)||equipmentProjectScope(db,item.id))throw Object.assign(Error('Project equipment approval required'),{status:403});}
 existing=db.prepare('SELECT gear_id FROM equipment_links WHERE owner_id=? AND project_id=? AND equipment_id=?').get(uid,pid,item.id);id=existing?.gear_id||randomUUID();let gear=p.gear.find(g=>g.id===id);if(!gear){gear={id,name:item.name,category:item.category,owner:'',assignee:'',status:'check'};p.gear.push(gear);}const source=equipmentSource(db,uid,pid,item);gear.equipmentId=item.id;gear.equipmentSource=source.source;gear.ownerMemberId=scope?data.ownerMemberId||null:source.memberId||null;gear.assigneeMemberId=data.assigneeMemberId||null;gear.owner=source.ownerLabel;gear.assignee=p.members.find(m=>m.id===data.assigneeMemberId)?.name||'';
 db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,project_id,gear_id) DO UPDATE SET owner_member_id=excluded.owner_member_id,assignee_member_id=excluded.assignee_member_id').run(uid,pid,id,item.id,gear.ownerMemberId,gear.assigneeMemberId);writeWorkspace(db,uid,current.state,current.revision);db.exec('COMMIT');json(existing?200:201,{gearId:id,equipmentId:item.id});return true;
 }catch(e){db.exec('ROLLBACK');throw e;}}
 if((path==='/api/equipment'||path==='/api/admin/equipment')&&req.method==='GET'){
 const rows=db.prepare(path==='/api/admin/equipment'?'SELECT w.user_id,w.body,u.username FROM workspaces w JOIN users u ON u.id=w.user_id':'SELECT w.user_id,w.body,u.username FROM workspaces w JOIN users u ON u.id=w.user_id WHERE w.user_id=?').all(...(path==='/api/equipment'?[uid]:[]));
 const equipment=rows.flatMap(r=>projects(reconcileEquipment(db,r.user_id,JSON.parse(r.body))).flatMap(p=>p.gear.map(g=>({...g,catalogId:g.equipmentId||`${r.user_id}:${p.project.id||'project-main'}:${g.id}`,ownerAccountId:r.user_id,username:r.username,projectId:p.project.id||'project-main',projectName:p.project.name}))));const catalog=db.prepare(path==='/api/admin/equipment'?'SELECT e.id,e.owner_id AS ownerAccountId,e.name,e.category,u.username FROM equipment_items e JOIN users u ON u.id=e.owner_id':'SELECT e.id,e.owner_id AS ownerAccountId,e.name,e.category,u.username FROM equipment_items e JOIN users u ON u.id=e.owner_id WHERE e.owner_id=?').all(...(path==='/api/equipment'?[uid]:[]));const inventoryFields=['quantity','outstanding','available','storageLocation','condition','model','inventoryCode','ownership'];json(200,{equipment,catalog:catalog.filter(item=>path==='/api/admin/equipment'||(!equipmentProjectScope(db,item.id)&&getInventoryMetadata(db,item.id).ownership!=='organization')).map(item=>{const metadata=getInventoryMetadata(db,item.id);return {...item,...Object.fromEntries(inventoryFields.map(key=>[key,metadata[key]]))};})});return true;}
 const route=path.match(/^\/api\/projects\/([A-Za-z0-9_-]{1,80})\/(members|teams)(?:\/([A-Za-z0-9_-]{1,80})\/teams)?$/);
 if(route){const [,pid,section,memberId]=route,current=readWorkspace(db,uid),p=projects(current.state).find(p=>(p.project.id||'project-main')===pid);if(!p)return fail(404,'Project not found');
 if(section==='members'&&req.method==='GET'){json(200,{members:linkedWorkspace(db,uid,current.state)&&p.members,accounts:db.prepare('SELECT user_id AS userId,member_id AS memberId FROM project_accounts WHERE owner_id=? AND project_id=?').all(uid,pid)});return true;}
 if(section==='members'&&!memberId&&req.method==='POST'){
 const data=await readJson(16384);if(!data||typeof data.userId!=='string')return fail(400,'Account required');const user=db.prepare("SELECT u.id,u.username,COALESCE(p.name,'') name FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id WHERE u.id=?").get(data.userId);if(!user||!accountActive(db,user.id)||user.id===uid)return fail(400,'Account unavailable');
 const existing=db.prepare('SELECT member_id FROM project_accounts WHERE owner_id=? AND project_id=? AND user_id=?').get(uid,pid,user.id);if(existing){json(200,{memberId:existing.member_id});return true;}
 const id=randomUUID();db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run(uid,pid,user.id,id,Date.now());linkedWorkspace(db,uid,current.state);writeWorkspace(db,uid,current.state,current.revision);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}json(201,{memberId:id});return true;}
 if(section==='teams'&&req.method==='GET'){const teams=db.prepare('SELECT id,name FROM project_teams WHERE owner_id=? AND project_id=?').all(uid,pid).map(t=>({...t,memberIds:db.prepare('SELECT member_id FROM project_team_members WHERE team_id=?').all(t.id).map(m=>m.member_id)}));json(200,{teams});return true;}
 if((section==='teams'&&req.method==='POST')||(memberId&&req.method==='PUT')){
 const data=await readJson(16384),reject=(status,message)=>{throw Object.assign(Error(message),{status});};
 if(!data||(Object.hasOwn(data,'revision')&&!Number.isSafeInteger(data.revision)))return fail(400,'Invalid team revision');
 const expected=data.revision??current.revision;let result;
 db.exec('BEGIN IMMEDIATE');try{
  const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(uid);
  if(!row||row.revision!==expected)reject(409,'Workspace changed. Reload before editing.');
  const latest=linkedWorkspace(db,uid,JSON.parse(row.body)),project=projects(latest).find(entry=>(entry.project.id||'project-main')===pid);
  if(!project)reject(404,'Project not found');
  if(section==='teams'){
   if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80)reject(400,'Team name required');
   const id=randomUUID();db.prepare('INSERT INTO project_teams VALUES(?,?,?,?)').run(id,uid,pid,data.name.trim());result={id,name:data.name.trim()};
  }else{
   if(!project.members.some(m=>m.id===memberId)||!Array.isArray(data.teamIds)||data.teamIds.length>100||new Set(data.teamIds).size!==data.teamIds.length||data.teamIds.some(id=>typeof id!=='string'||!db.prepare('SELECT id FROM project_teams WHERE id=? AND owner_id=? AND project_id=?').get(id,uid,pid)))reject(400,'Invalid team assignment');
   db.prepare('DELETE FROM project_team_members WHERE member_id=? AND team_id IN (SELECT id FROM project_teams WHERE owner_id=? AND project_id=?)').run(memberId,uid,pid);
   for(const id of data.teamIds)db.prepare('INSERT INTO project_team_members VALUES(?,?)').run(id,memberId);result={ok:true};
  }
  if(db.prepare('UPDATE workspaces SET revision=revision+1 WHERE user_id=? AND revision=?').run(uid,expected).changes!==1)reject(409,'Workspace changed. Reload before editing.');
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 json(section==='teams'?201:200,{...result,revision:expected+1});return true;
 }}
 const shared=path.match(/^\/api\/projects\/([A-Za-z0-9_-]{1,80})\/shared$/);if(shared&&req.method==='GET'){const owner=url.searchParams.get('owner');if(!db.prepare('SELECT user_id FROM project_accounts WHERE owner_id=? AND project_id=? AND user_id=?').get(owner,shared[1],uid))return fail(404,'Project not found');const p=projects(readWorkspace(db,owner).state).find(p=>(p.project.id||'project-main')===shared[1]);if(!p)return fail(404,'Project not found');json(200,{project:sharedProjectProjection(p),readOnly:true});return true;}
 return fail(404,'Not found');
 };}
