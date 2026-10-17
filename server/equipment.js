import {randomUUID} from 'node:crypto';
const projects=state=>[state,...(state.projects||[])];
const fail=()=>{throw Object.assign(Error('Invalid equipment account or member link'),{status:400});};
export function reconcileEquipment(db,uid,state,{write=false}={}){
 const seen=new Map();
 for(const p of projects(state))for(const g of p.gear){
  const pid=p.project.id||'project-main',link=db.prepare('SELECT * FROM equipment_links WHERE owner_id=? AND project_id=? AND gear_id=?').get(uid,pid,g.id);
  let item=link&&db.prepare('SELECT * FROM equipment_items WHERE id=? AND owner_id=?').get(link.equipment_id,uid);
  if(g.equipmentId&&(!item||item.id!==g.equipmentId)){item=db.prepare('SELECT * FROM equipment_items WHERE id=? AND owner_id=?').get(g.equipmentId,uid);if(!item)fail();}
  if([g.ownerMemberId,g.assigneeMemberId].some(id=>id!==undefined&&id!==null&&!p.members.some(m=>m.id===id)))fail();
  if(!item&&write){item={id:randomUUID(),owner_id:uid,name:g.name,category:g.category||'other'};db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run(item.id,uid,item.name,item.category);}
  if(!item)continue;
  if(write&&!seen.has(item.id)){item={...item,name:g.name,category:g.category||'other'};db.prepare('UPDATE equipment_items SET name=?,category=? WHERE id=? AND owner_id=?').run(item.name,item.category,item.id,uid);}
  item=seen.get(item.id)||item;seen.set(item.id,item);g.equipmentId=item.id;g.name=item.name;g.category=item.category;
  if(write){const duplicate=db.prepare('SELECT gear_id FROM equipment_links WHERE owner_id=? AND project_id=? AND equipment_id=?').get(uid,pid,item.id);if(duplicate&&duplicate.gear_id!==g.id)fail();db.prepare('INSERT INTO equipment_links VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,project_id,gear_id) DO UPDATE SET equipment_id=excluded.equipment_id,owner_member_id=excluded.owner_member_id,assignee_member_id=excluded.assignee_member_id').run(uid,pid,g.id,item.id,g.ownerMemberId||null,g.assigneeMemberId||null);}
  const owner=g.ownerMemberId??link?.owner_member_id,assignee=g.assigneeMemberId??link?.assignee_member_id;if(owner){g.ownerMemberId=owner;g.owner=p.members.find(m=>m.id===owner)?.name||g.owner;}if(assignee){g.assigneeMemberId=assignee;g.assignee=p.members.find(m=>m.id===assignee)?.name||g.assignee;}
 }
 return state;
}
