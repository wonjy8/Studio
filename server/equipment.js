import {assertInventoryIdentityChange,bumpInventoryRevision} from './inventory.js';
import {randomUUID} from 'node:crypto';
import {equipmentProjectAccess,equipmentProjectScope,equipmentSource} from './equipment-sharing.js';
import {orgCanManage} from './inventory-organizations.js';
const projects=state=>[state,...(state.projects||[])];
const fail=()=>{throw Object.assign(Error('Invalid equipment account or member link'),{status:400});};
export function assertEquipmentCategory(db,uid,equipmentId,category,candidate){
 if(category==='camera')return;
 const rows=db.prepare('SELECT user_id,body FROM workspaces').all(),states=rows.map(row=>({uid:row.user_id,state:row.user_id===uid&&candidate?candidate:JSON.parse(row.body)}));if(candidate&&!rows.some(row=>row.user_id===uid))states.push({uid,state:candidate});
 for(const entry of states)for(const p of projects(entry.state)){const pid=p.project.id||'project-main';for(const gear of p.gear){const link=db.prepare('SELECT equipment_id FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(entry.uid,pid,gear.id);if((gear.equipmentId===equipmentId||link?.equipment_id===equipmentId)&&p.cameras.some(c=>c.gearId===gear.id))throw Object.assign(Error('Camera-linked equipment must remain in camera category'),{status:400});}}
}
export function reconcileEquipment(db,uid,state,{write=false,previous}={}){
 const seen=new Map(),edits=new Map();
 // Read-time canonical baselines distinguish explicit edits from stale copies.
 // A project switch changes traversal order, never canonical inventory values.
 if(write&&previous)for(const p of projects(state))for(const g of p.gear){
  const pid=p.project.id||'project-main',oldProject=projects(previous).find(old=>(old.project.id||'project-main')===pid),old=oldProject?.gear.find(old=>old.id===g.id);
  const link=db.prepare('SELECT equipment_id FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(uid,pid,g.id),id=g.equipmentId||link?.equipment_id;
  if(!id||!old||(old.equipmentId&&old.equipmentId!==id))continue;
  const canonical=db.prepare('SELECT * FROM equipment_items WHERE id=?').get(id);if(!canonical)fail();
  if(!equipmentProjectAccess(db,uid,pid,canonical)){if(g.name!==old.name||(g.category||'other')!==(old.category||'other'))throw Object.assign(Error('Equipment access was revoked'),{status:403});continue;}
  const inventory=db.prepare('SELECT ownership,organization_id FROM inventory_metadata WHERE equipment_id=?').get(id),scope=equipmentProjectScope(db,id);
  const canEdit=scope?scope.project_owner_id===uid&&scope.project_id===pid:inventory?.ownership==='organization'?orgCanManage(db,uid,inventory.organization_id):canonical.owner_id===uid;
  const changes=edits.get(id)||{};
  for(const key of ['name','category']){
   const value=key==='category'?(g[key]||'other'):g[key],baseKey=key==='name'?'equipmentBaseName':'equipmentBaseCategory',before=g[baseKey]??(key==='category'?(old[key]||'other'):old[key]);
   if(value===before||value===canonical[key])continue;
   if(!canEdit)throw Object.assign(Error('Canonical equipment owner required'),{status:403});
   if(before!==canonical[key]||(Object.hasOwn(changes,key)&&changes[key]!==value))throw Object.assign(Error('Conflicting equipment edits. Reload before editing.'),{status:409});changes[key]=value;
  }
  edits.set(id,changes);
 }

 if(write)for(const [id,changes] of edits){assertInventoryIdentityChange(db,id,changes);if(Object.keys(changes).length&&equipmentProjectScope(db,id))db.prepare("UPDATE equipment_claims SET status='revoked',revision=revision+1 WHERE equipment_id=? AND status='pending'").run(id);}
 for(const p of projects(state))for(const g of p.gear){
  const pid=p.project.id||'project-main',link=db.prepare('SELECT * FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(uid,pid,g.id);
  let item=link&&db.prepare('SELECT * FROM equipment_items WHERE id=?').get(link.equipment_id);
  if(g.equipmentId&&(!item||item.id!==g.equipmentId)){item=db.prepare('SELECT * FROM equipment_items WHERE id=?').get(g.equipmentId);if(!item)fail();}
  if(item&&!equipmentProjectAccess(db,uid,pid,item)){const old=previous&&projects(previous).find(p=>(p.project.id||'project-main')===pid)?.gear.find(old=>old.id===g.id);if(write&&(!link||link.equipment_id!==item.id||!old||old.equipmentId!==item.id))throw Object.assign(Error('Project equipment approval required'),{status:403});g.canEditEquipment=false;g.equipmentUnavailable=true;continue;}
  const ownerExplicit=Object.hasOwn(g,'ownerMemberId'),assigneeExplicit=Object.hasOwn(g,'assigneeMemberId');
  const owner=ownerExplicit?g.ownerMemberId:(link?.owner_member_id??null),assignee=assigneeExplicit?g.assigneeMemberId:(link?.assignee_member_id??null);
  if([owner,assignee].some(id=>id!==null&&id!==undefined&&!p.members.some(m=>m.id===id)))fail();
  if(!item&&write){item={id:randomUUID(),owner_id:uid,name:g.name,category:g.category||'other'};db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run(item.id,uid,item.name,item.category);db.prepare('INSERT INTO equipment_project_scope VALUES(?,?,?,?,?)').run(item.id,uid,pid,owner??null,p.members.find(m=>m.id===owner)?.name||g.owner||'');}
  if(!item)continue;
  if(write&&!seen.has(item.id)){const previousItem=item;item={...item,...edits.get(item.id)};assertEquipmentCategory(db,uid,item.id,item.category,state);db.prepare('UPDATE equipment_items SET name=?,category=? WHERE id=?').run(item.name,item.category,item.id);if(item.name!==previousItem.name||item.category!==previousItem.category)bumpInventoryRevision(db,item.id);}
  item=seen.get(item.id)||item;seen.set(item.id,item);const oldName=g.name;const source=equipmentSource(db,uid,pid,item);g.equipmentSource=source.source;g.equipmentOwnerLabel=source.ownerLabel;g.equipmentUnavailable=false;const inventory=db.prepare('SELECT ownership,organization_id FROM inventory_metadata WHERE equipment_id=?').get(item.id);g.canEditEquipment=source.source==='manual'||(inventory?.ownership==='organization'?orgCanManage(db,uid,inventory.organization_id):item.owner_id===uid);g.equipmentId=item.id;g.name=item.name;g.category=item.category;g.equipmentBaseName=item.name;g.equipmentBaseCategory=item.category;for(const camera of p.cameras)if(camera.gearId===g.id)camera.body=g.name;for(const object of p.layoutObjects||[])if(object.gearId===g.id&&object.name===oldName)object.name=g.name;
  if(write){const duplicate=db.prepare('SELECT gear_id FROM equipment_links WHERE owner_id=? AND project_id=? AND equipment_id=?').get(uid,pid,item.id);if(duplicate&&duplicate.gear_id!==g.id)fail();db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,project_id,gear_id) DO UPDATE SET equipment_id=excluded.equipment_id,owner_member_id=excluded.owner_member_id,assignee_member_id=excluded.assignee_member_id').run(uid,pid,g.id,item.id,owner??null,assignee??null);}
  const priorGear=previous&&projects(previous).find(old=>(old.project.id||'project-main')===pid)?.gear.find(old=>old.id===g.id);
  const wasLinkedLabel=(field,memberId)=>Boolean(memberId)&&(g[field]===p.members.find(member=>member.id===memberId)?.name||(priorGear&&g[field]===priorGear[field]));
  if(source.source==='organization'||source.source==='member'){g.owner=source.ownerLabel;g.ownerMemberId=source.memberId||null;}else if(owner){g.ownerMemberId=owner;g.owner=p.members.find(m=>m.id===owner).name;}else if(ownerExplicit){g.ownerMemberId=null;if(wasLinkedLabel('owner',link?.owner_member_id))g.owner='';}
  if(write&&source.source==='manual'){const scope=equipmentProjectScope(db,item.id);if(scope.owner_name!==(g.owner||'')||scope.owner_member_id!==(owner??null))db.prepare("UPDATE equipment_claims SET status='revoked',revision=revision+1 WHERE equipment_id=? AND status='pending'").run(item.id);db.prepare('UPDATE equipment_project_scope SET owner_member_id=?,owner_name=? WHERE equipment_id=?').run(owner??null,g.owner||'',item.id);}
  if(assignee){g.assigneeMemberId=assignee;g.assignee=p.members.find(m=>m.id===assignee).name;}else if(assigneeExplicit){g.assigneeMemberId=null;if(wasLinkedLabel('assignee',link?.assignee_member_id))g.assignee='';}
 }
 return state;
}
