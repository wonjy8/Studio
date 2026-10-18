import {assertInventoryIdentityChange,bumpInventoryRevision} from './inventory.js';
import {randomUUID} from 'node:crypto';
const projects=state=>[state,...(state.projects||[])];
const fail=()=>{throw Object.assign(Error('Invalid equipment account or member link'),{status:400});};
export function assertEquipmentCategory(db,uid,equipmentId,category,candidate){
 if(category==='camera')return;
 const row=!candidate&&db.prepare('SELECT body FROM workspaces WHERE user_id=?').get(uid),state=candidate||(row&&JSON.parse(row.body));if(!state)return;
 for(const p of projects(state)){const pid=p.project.id||'project-main';for(const gear of p.gear){const link=db.prepare('SELECT equipment_id FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(uid,pid,gear.id);if((gear.equipmentId===equipmentId||link?.equipment_id===equipmentId)&&p.cameras.some(c=>c.gearId===gear.id))throw Object.assign(Error('Camera-linked equipment must remain in camera category'),{status:400});}}
}
export function reconcileEquipment(db,uid,state,{write=false,previous}={}){
 const seen=new Map(),edits=new Map();
 // Read-time canonical baselines distinguish explicit edits from stale copies.
 // A project switch changes traversal order, never canonical inventory values.
 if(write&&previous)for(const p of projects(state))for(const g of p.gear){
  const pid=p.project.id||'project-main',oldProject=projects(previous).find(old=>(old.project.id||'project-main')===pid),old=oldProject?.gear.find(old=>old.id===g.id);
  const link=db.prepare('SELECT equipment_id FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(uid,pid,g.id),id=g.equipmentId||link?.equipment_id;
  if(!id||!old||(old.equipmentId&&old.equipmentId!==id))continue;
  const canonical=db.prepare('SELECT name,category FROM equipment_items WHERE id=? AND owner_id=?').get(id,uid);if(!canonical)fail();
  const changes=edits.get(id)||{};
  for(const key of ['name','category']){
   const value=key==='category'?(g[key]||'other'):g[key],baseKey=key==='name'?'equipmentBaseName':'equipmentBaseCategory',before=g[baseKey]??(key==='category'?(old[key]||'other'):old[key]);
   if(value===before||value===canonical[key])continue;
   if(before!==canonical[key]||(Object.hasOwn(changes,key)&&changes[key]!==value))throw Object.assign(Error('Conflicting equipment edits. Reload before editing.'),{status:409});changes[key]=value;
  }
  edits.set(id,changes);
 }

 if(write)for(const [id,changes] of edits)assertInventoryIdentityChange(db,id,changes);
 for(const p of projects(state))for(const g of p.gear){
  const pid=p.project.id||'project-main',link=db.prepare('SELECT * FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(uid,pid,g.id);
  let item=link&&db.prepare('SELECT * FROM equipment_items WHERE id=? AND owner_id=?').get(link.equipment_id,uid);
  if(g.equipmentId&&(!item||item.id!==g.equipmentId)){item=db.prepare('SELECT * FROM equipment_items WHERE id=? AND owner_id=?').get(g.equipmentId,uid);if(!item)fail();}
  const ownerExplicit=Object.hasOwn(g,'ownerMemberId'),assigneeExplicit=Object.hasOwn(g,'assigneeMemberId');
  const owner=ownerExplicit?g.ownerMemberId:(link?.owner_member_id??null),assignee=assigneeExplicit?g.assigneeMemberId:(link?.assignee_member_id??null);
  if([owner,assignee].some(id=>id!==null&&id!==undefined&&!p.members.some(m=>m.id===id)))fail();
  if(!item&&write){item={id:randomUUID(),owner_id:uid,name:g.name,category:g.category||'other'};db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run(item.id,uid,item.name,item.category);}
  if(!item)continue;
  if(write&&!seen.has(item.id)){const previousItem=item;item={...item,...edits.get(item.id)};assertEquipmentCategory(db,uid,item.id,item.category,state);db.prepare('UPDATE equipment_items SET name=?,category=? WHERE id=? AND owner_id=?').run(item.name,item.category,item.id,uid);if(item.name!==previousItem.name||item.category!==previousItem.category)bumpInventoryRevision(db,item.id);}
  item=seen.get(item.id)||item;seen.set(item.id,item);const oldName=g.name;g.equipmentId=item.id;g.name=item.name;g.category=item.category;g.equipmentBaseName=item.name;g.equipmentBaseCategory=item.category;for(const camera of p.cameras)if(camera.gearId===g.id)camera.body=g.name;for(const object of p.layoutObjects||[])if(object.gearId===g.id&&object.name===oldName)object.name=g.name;
  if(write){const duplicate=db.prepare('SELECT gear_id FROM equipment_links WHERE owner_id=? AND project_id=? AND equipment_id=?').get(uid,pid,item.id);if(duplicate&&duplicate.gear_id!==g.id)fail();db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,project_id,gear_id) DO UPDATE SET equipment_id=excluded.equipment_id,owner_member_id=excluded.owner_member_id,assignee_member_id=excluded.assignee_member_id').run(uid,pid,g.id,item.id,owner??null,assignee??null);}
  const priorGear=previous&&projects(previous).find(old=>(old.project.id||'project-main')===pid)?.gear.find(old=>old.id===g.id);
  const wasLinkedLabel=(field,memberId)=>Boolean(memberId)&&(g[field]===p.members.find(member=>member.id===memberId)?.name||(priorGear&&g[field]===priorGear[field]));
  if(owner){g.ownerMemberId=owner;g.owner=p.members.find(m=>m.id===owner).name;}else if(ownerExplicit){g.ownerMemberId=null;if(wasLinkedLabel('owner',link?.owner_member_id))g.owner='';}
  if(assignee){g.assigneeMemberId=assignee;g.assignee=p.members.find(m=>m.id===assignee).name;}else if(assigneeExplicit){g.assigneeMemberId=null;if(wasLinkedLabel('assignee',link?.assignee_member_id))g.assignee='';}
 }
 return state;
}
