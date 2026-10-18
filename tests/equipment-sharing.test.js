import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {readWorkspace,writeWorkspace} from '../server/workspace-service.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-fictional-sharing-')),origin='http://localhost', {server,db}=await createApp({dir,origin,secure:false});
 for(const id of ['producer','member','outsider','organization']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,'fictional-'+id,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(id),id,Date.now()+600000);}
 const state=emptyWorkspace();state.project.id='fictional-a';state.members=[{id:'fictional-member',name:'Fictional Crew',role:'',call:''}];const second=emptyWorkspace();second.project.id='fictional-b';state.projects=[second];writeWorkspace(db,'producer',state,0);
 db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run('producer','fictional-a','member','fictional-member',Date.now());
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(user,path,method='GET',data)=>{const response=await fetch(base+path,{method,headers:{Origin:origin,...(user?{Cookie:'studio_session='+user}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json()};};
 const ok=async(...args)=>{const r=await call(...args);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.body;};
 const options=()=>ok('producer','/api/projects/fictional-a/equipment-options');
 const manual=()=>ok('producer','/api/projects/fictional-a/equipment-links','POST',{source:'manual',name:'Fictional Manual Light',category:'lighting',ownerMemberId:'fictional-member'});
 return {db,call,ok,options,manual};
}

test('manual project equipment remains scoped and account claims require explicit target acceptance and CAS',async t=>{
 const {db,call,ok,options,manual}=await fixture(t),created=await manual(),id=created.equipmentId;
 assert.equal((await options()).manual[0].gearId,created.gearId);
 for(const user of ['producer','member'])assert.equal((await ok(user,'/api/inventory')).items.some(item=>item.id===id),false);
 assert.equal((await ok('producer','/api/equipment')).catalog.some(item=>item.id===id),false);
 assert.equal((await call('producer','/api/projects/fictional-b/equipment-links','POST',{equipmentId:id})).status,403);
 const forged=readWorkspace(db,'producer');forged.state.projects[0].gear.push({...forged.state.gear[0],id:'fictional-cross-project'});assert.throws(()=>writeWorkspace(db,'producer',forged.state,forged.revision),e=>e.status===403);
 const path=`/api/projects/fictional-a/equipment/${created.gearId}/claim`,revision=readWorkspace(db,'producer').revision;
 assert.equal((await call('producer',path,'POST',{revision,userId:'member'})).status,400);
 assert.equal((await call('producer',path,'POST',{revision:revision-1,userId:'member',confirm:true})).status,409);
 assert.equal((await call('producer',path,'POST',{revision,userId:'outsider',confirm:true})).status,403);
 const pending=await ok('producer',path,'POST',{revision,userId:'member',confirm:true});assert.equal((await ok('outsider','/api/inventory/equipment-claims')).claims.length,0);
 assert.equal((await call('outsider',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1})).status,404);
 assert.equal((await call('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:0})).status,409);
 assert.equal((await ok('member','/api/inventory')).items.length,0);
 await ok('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1});assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(id).owner_id,'member');
 assert.equal((await ok('member','/api/inventory')).items[0].id,id);assert.equal(readWorkspace(db,'producer').state.gear[0].equipmentId,id);assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_items WHERE id=?').get(id).n,1);
 assert.equal((await call('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1})).status,404);
 const edited=readWorkspace(db,'producer');edited.state.gear[0].name='Fictional Forbidden Rename';assert.throws(()=>writeWorkspace(db,'producer',edited.state,edited.revision),e=>e.status===403);
});

test('member personal inventory is opt-in per project, canonical readonly and revocation immediate',async t=>{
 const {db,call,ok,options}=await fixture(t),item=(await ok('member','/api/inventory/items','POST',{name:'Fictional Private Member Light',category:'lighting',model:'Fictional Private Model',storageLocation:'Fictional Private Shelf',trackingMode:'bulk',quantity:2})).item;
 assert.equal((await options()).catalog.some(value=>value.id===item.id),false);assert.equal((await call('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:item.id})).status,403);
 await ok('member',`/api/equipment/${item.id}/project-approvals`,'POST',{projectOwnerId:'producer',projectId:'fictional-a'});
 const selected=(await options()).catalog.find(value=>value.id===item.id);assert.ok(selected);for(const key of ['model','storageLocation','quantity','available','ownerId'])assert.equal(selected[key],undefined,key);
 const link=await ok('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:item.id}),duplicate=await ok('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:item.id});assert.equal(link.gearId,duplicate.gearId);
 assert.equal((await call('producer','/api/projects/fictional-b/equipment-links','POST',{equipmentId:item.id})).status,403);
 const snapshot=readWorkspace(db,'producer');assert.equal(snapshot.state.gear[0].canEditEquipment,false);snapshot.state.gear[0].category='audio';assert.throws(()=>writeWorkspace(db,'producer',snapshot.state,snapshot.revision),e=>e.status===403);
 assert.equal((await call('producer',`/api/equipment/${item.id}`,'PUT',{name:'Forbidden',category:'lighting'})).status,404);
 await ok('member',`/api/equipment/${item.id}/project-approvals/producer/fictional-a`,'DELETE');assert.equal((await options()).catalog.some(value=>value.id===item.id),false);
 const after=readWorkspace(db,'producer');assert.equal(after.state.gear[0].equipmentUnavailable,true);after.state.gear[0].name='Forbidden after revoke';assert.throws(()=>writeWorkspace(db,'producer',after.state,after.revision),e=>e.status===403);
 assert.equal((await ok('producer','/api/inventory')).items.some(value=>value.id===item.id),false);assert.equal((await ok('producer','/api/inventory/loans?status=all')).loans.length,0);
});

test('organization project approval exposes minimal equipment options without organization inventory or history',async t=>{
 const {db,call,ok,options}=await fixture(t),org=(await ok('organization','/api/inventory/organizations','POST',{name:'Fictional Shared Organization'})).organization;
 db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run('producer','fictional-a','organization','fictional-org-member',Date.now());
 const item=(await ok('organization','/api/inventory/items','POST',{name:'Fictional Org Light',category:'lighting',ownership:'organization',organizationId:org.id,model:'Fictional Secret Model',storageLocation:'Fictional Secret Storage'})).item;
 assert.equal((await options()).catalog.some(value=>value.id===item.id),false);
 const orgPath=`/api/inventory/organizations/${org.id}`,detail=()=>ok('organization',orgPath);await ok('organization',orgPath+'/projects','POST',{revision:(await detail()).organization.revision,projectOwnerId:'producer',projectId:'fictional-a'});
 const row=(await options()).catalog.find(value=>value.id===item.id);assert.ok(row);for(const key of ['model','storageLocation','quantity','ownerId','borrower'])assert.equal(row[key],undefined);
 const link=await ok('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:item.id});assert.equal(link.equipmentId,item.id);assert.equal((await ok('producer','/api/inventory')).items.length,0);assert.equal((await ok('producer','/api/inventory/loans?status=all')).loans.length,0);
 assert.equal((await call('producer','/api/projects/fictional-b/equipment-links','POST',{equipmentId:item.id})).status,403);
 const bad=readWorkspace(db,'producer');bad.state.gear[0].name='Fictional Forbidden Org Edit';assert.throws(()=>writeWorkspace(db,'producer',bad.state,bad.revision),e=>e.status===403);
 await ok('organization',orgPath+'/projects/producer/fictional-a','DELETE',{revision:(await detail()).organization.revision});assert.equal((await options()).catalog.some(value=>value.id===item.id),false);assert.equal(readWorkspace(db,'producer').state.gear[0].equipmentUnavailable,true);
 assert.equal((await call('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:item.id})).status,403);
});

test('claim acceptance rechecks outstanding loans atomically and preserves canonical identity until resolved',async t=>{
 const {db,call,ok,manual}=await fixture(t),gear=await manual(),path=`/api/projects/fictional-a/equipment/${gear.gearId}/claim`,revision=readWorkspace(db,'producer').revision;
 const pending=await ok('producer',path,'POST',{revision,userId:'member',confirm:true});
 // Simulate a retained legacy borrowing relation arriving after the proposal.
 db.prepare('INSERT INTO inventory_loans VALUES(?,?,?,?,?,?,?,?)').run('fictional-old-loan','producer','Fictional Borrower','','',new Date(Date.now()+86400000).toISOString(),'',Date.now());
 db.prepare('INSERT INTO inventory_loan_lines VALUES(?,?,?,?,?)').run('fictional-old-line','fictional-old-loan',gear.equipmentId,1,JSON.stringify({name:'Fictional Manual Light',ownership:'personal',ownerId:'producer'}));
 assert.equal((await call('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1})).status,409);
 assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(gear.equipmentId).owner_id,'producer');assert.equal(db.prepare('SELECT status FROM equipment_claims WHERE id=?').get(pending.id).status,'pending');
 assert.equal((await call('producer',path,'POST',{revision,userId:'member',confirm:true})).status,409);
 db.prepare('INSERT INTO inventory_returns VALUES(?,?,?,?,?)').run('fictional-old-return','fictional-old-loan','producer','Fictional completed return',Date.now());db.prepare('INSERT INTO inventory_return_lines VALUES(?,?,?)').run('fictional-old-return','fictional-old-line',1);
 await ok('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1});assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(gear.equipmentId).owner_id,'member');assert.equal(readWorkspace(db,'producer').state.gear[0].equipmentId,gear.equipmentId);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_items').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_links WHERE equipment_id=?').get(gear.equipmentId).n,1);
});

test('removed project membership cancels effective personal grant and pending claim authority immediately',async t=>{
 const {db,call,ok,manual}=await fixture(t),manualGear=await manual(),current=readWorkspace(db,'producer');const pending=await ok('producer',`/api/projects/fictional-a/equipment/${manualGear.gearId}/claim`,'POST',{revision:current.revision,userId:'member',confirm:true});
 const personal=(await ok('member','/api/inventory/items','POST',{name:'Fictional Membership Light',category:'lighting'})).item;await ok('member',`/api/equipment/${personal.id}/project-approvals`,'POST',{projectOwnerId:'producer',projectId:'fictional-a'});
 db.prepare('DELETE FROM project_accounts WHERE owner_id=? AND project_id=? AND user_id=?').run('producer','fictional-a','member');
 assert.equal((await ok('member','/api/inventory/equipment-claims')).claims.length,0);assert.equal((await call('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1})).status,403);
 assert.equal((await ok('producer','/api/projects/fictional-a/equipment-options')).catalog.some(item=>item.id===personal.id),false);assert.equal((await call('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:personal.id})).status,403);
 assert.equal((await call('outsider','/api/projects/fictional-a/equipment-options')).status,404);assert.equal((await call('', '/api/projects/fictional-a/equipment-options')).status,401);
});

test('organization canonical category cannot invalidate a camera setup in an approved foreign project',async t=>{
 const {db,call,ok}=await fixture(t),org=(await ok('organization','/api/inventory/organizations','POST',{name:'Fictional Camera Organization'})).organization;
 db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run('producer','fictional-a','organization','fictional-camera-org-member',Date.now());
 const item=(await ok('organization','/api/inventory/items','POST',{name:'Fictional Shared Camera',category:'camera',ownership:'organization',organizationId:org.id})).item;
 await ok('organization',`/api/inventory/organizations/${org.id}/projects`,'POST',{revision:org.revision,projectOwnerId:'producer',projectId:'fictional-a'});
 const linked=await ok('producer','/api/projects/fictional-a/equipment-links','POST',{equipmentId:item.id}),state=readWorkspace(db,'producer');state.state.cameras=[{id:'fictional-shared-camera-position',name:'Fictional Shared Position',role:'',operator:'',body:item.name,lens:'',x:50,y:50,refs:[],gearId:linked.gearId}];writeWorkspace(db,'producer',state.state,state.revision);
 assert.equal((await call('organization',`/api/inventory/items/${item.id}`,'PUT',{revision:item.revision,category:'lighting'})).status,400);
 assert.equal(db.prepare('SELECT category FROM equipment_items WHERE id=?').get(item.id).category,'camera');
});

test('pending manual claims revoke on committed identity or owner changes but survive rejected stale workspace saves',async t=>{
 const {db,call,ok,manual}=await fixture(t);
 for(const change of ['name','category','owner']){
  const gear=await manual(),path=`/api/projects/fictional-a/equipment/${gear.gearId}/claim`,current=readWorkspace(db,'producer'),pending=await ok('producer',path,'POST',{revision:current.revision,userId:'member',confirm:true});
  const candidate=structuredClone(current.state),item=candidate.gear.find(value=>value.id===gear.gearId);
  if(change==='name')item.name='Fictional Changed Claim Light';else if(change==='category')item.category='audio';else {item.ownerMemberId=null;item.owner='Fictional Revised Manual Owner';}
  assert.throws(()=>writeWorkspace(db,'producer',candidate,current.revision-1),error=>error.status===409);
  assert.equal(db.prepare('SELECT status FROM equipment_claims WHERE id=?').get(pending.id).status,'pending');assert.equal((await ok('member','/api/inventory/equipment-claims')).claims.some(value=>value.id===pending.id),true);
  writeWorkspace(db,'producer',candidate,current.revision);
  assert.equal(db.prepare('SELECT status FROM equipment_claims WHERE id=?').get(pending.id).status,'revoked',change);
  assert.equal((await ok('member','/api/inventory/equipment-claims')).claims.some(value=>value.id===pending.id),false);
  assert.equal((await call('member',`/api/inventory/equipment-claims/${pending.id}/accept`,'POST',{revision:1})).status,404,change);
  assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(gear.equipmentId).owner_id,'producer');
 }
});
