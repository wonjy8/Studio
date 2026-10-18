import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {readWorkspace,writeWorkspace} from '../server/workspace-service.js';
import {applyCommands} from '../src/domain/commands.js';
import {switchProject} from '../src/domain/projects.js';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-inventory-fictional-')),origin='http://localhost';
 const {server,db}=await createApp({dir,origin,secure:false});
 for(const id of ['fictional-owner','fictional-other','fictional-operator','fictional-admin']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(id),id,Date.now()+3600000);}
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id',?)").run('fictional-admin');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',body,user='fictional-owner')=>{const r=await fetch(base+path,{method,headers:{Origin:origin,...(user?{Cookie:`studio_session=${user}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
 const ok=async(path,method='GET',body,user)=>{const legacy=path.match(/^\/api\/inventory\/organizations\/([^/]+)\/operators(?:\/([^/]+))?$/);if(legacy&&method==='POST'){const detail=await call('/api/inventory/organizations/'+legacy[1],'GET',undefined,user);assert.equal(detail.status,200);const target=db.prepare('SELECT id FROM users WHERE username=?').get(body.username);assert.ok(target);if(detail.body.members.some(member=>member.userId===target.id))return {ok:true};const pending=await call('/api/inventory/organizations/'+legacy[1]+'/invitations','POST',{userId:target.id,role:'operator',revision:detail.body.organization.revision},user);assert.equal(pending.status,201);const accepted=await call('/api/inventory/invitations/'+pending.body.invitation.id+'/accept','POST',{revision:pending.body.invitation.revision},target.id);assert.equal(accepted.status,200);return {ok:true};}if(legacy&&method==='DELETE'&&!body){const detail=await call('/api/inventory/organizations/'+legacy[1],'GET',undefined,user);assert.equal(detail.status,200);body={revision:detail.body.organization.revision};}const r=await call(path,method,body,user);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.body;};
 const create=async(fields={})=>ok('/api/inventory/items','POST',{name:'Fictional Light',category:'lighting',model:'Fictional Model',trackingMode:'bulk',quantity:5,...fields});
 const loan=(id,quantity,requestId)=>({requestId,borrower:'Fictional Crew',team:'Fictional Camera',destination:'Fictional Set',dueAt:new Date(Date.now()+86400000).toISOString(),note:'Isolated fixture',lines:[{equipmentId:id,quantity}]});
 return {db,call,ok,create,loan,dir};
}

test('inventory bulk stock, idempotency, simultaneous checkout and partial returns are atomic',async t=>{
 const {call,ok,create,loan}=await fixture(t),gear=await create(),id=gear.item?.id||gear.equipment?.id||gear.id;
 assert.ok(id);const first=loan(id,3,'fictional-checkout-a'),a=await ok('/api/inventory/loans','POST',first);
 assert.equal(a.loan.lines[0].outstanding,3);const replay=await ok('/api/inventory/loans','POST',first);assert.equal(replay.loan.id,a.loan.id);assert.equal(replay.replayed,true);
 assert.equal((await call('/api/inventory/loans','POST',{...first,lines:[{equipmentId:id,quantity:1}]})).status,409);
 for(const quantity of [0,-1,.5,6])assert.ok((await call('/api/inventory/loans','POST',loan(id,quantity,`fictional-invalid-${quantity}`))).status>=400);
 const simultaneous=await Promise.all(['b','c'].map(key=>call('/api/inventory/loans','POST',loan(id,2,'fictional-race-'+key))));assert.deepEqual(simultaneous.map(r=>r.status).sort(),[201,409]);
 const line=a.loan.lines[0],returnPath=`/api/inventory/loans/${a.loan.id}/returns`,partial={requestId:'fictional-return-one',note:'Fictional partial',lines:[{lineId:line.lineId||line.id,quantity:1}]};
 const returned=await ok(returnPath,'POST',partial);assert.equal(returned.loan.lines[0].returned,1);assert.equal(returned.loan.lines[0].outstanding,2);
 const duplicate=await ok(returnPath,'POST',partial);assert.equal(duplicate.replayed,true);assert.equal(duplicate.loan.lines[0].returned,1);
 assert.equal((await call(returnPath,'POST',{...partial,requestId:'fictional-too-many',lines:[{lineId:line.lineId||line.id,quantity:3}]})).status,409);
 const second=await ok(returnPath,'POST',{...partial,requestId:'fictional-return-two'});assert.equal(second.loan.lines[0].returned,2);assert.equal(second.loan.returns.length,2);
 const finished=await ok(returnPath,'POST',{...partial,requestId:'fictional-return-three'});assert.equal(finished.loan.lines[0].outstanding,0);assert.equal(finished.loan.returns.length,3);
 assert.equal((await call(returnPath,'POST',{...partial,requestId:'fictional-return-over'})).status,409);
 assert.equal((await call(returnPath,'POST',{...partial,requestId:'fictional-foreign-return'},'fictional-other')).status,403);
 assert.equal((await call('/api/inventory/loans','POST',loan(id,1,'fictional-foreign-loan'),'fictional-other')).status,403);
 assert.equal((await call('/api/inventory','GET',undefined,'')).status,401);
});

test('active loans lock canonical identity through catalog, workspace and MCP domain mutations',async t=>{
 const {db,call,ok,loan}=await fixture(t);const state=emptyWorkspace();state.project.id='fictional-a';state.gear=[{id:'fictional-alias',name:'Fictional Shared Lamp',category:'lighting',owner:'',assignee:'',status:'check'}];
 writeWorkspace(db,'fictional-owner',state,0);let current=readWorkspace(db,'fictional-owner');const id=current.state.gear[0].equipmentId;assert.notEqual(id,'fictional-alias');
 const other=emptyWorkspace();other.project.id='fictional-b';other.gear=[{...current.state.gear[0],id:'fictional-alias-b'}];current.state.projects=[other];writeWorkspace(db,'fictional-owner',current.state,current.revision);
 const active=await ok('/api/inventory/loans','POST',loan(id,1,'fictional-lock-loan'));
 assert.equal((await call('/api/inventory/loans','POST',loan('fictional-alias',1,'fictional-alias-rejected'))).status,404);
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Changed',category:'lighting'})).status,409);
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Shared Lamp',category:'audio'})).status,409);
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Shared Lamp',category:'lighting'})).status,200);
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Foreign',category:'lighting'},'fictional-other')).status,404);
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Shared Lamp',category:'lighting',quantity:99})).status,400);
 current=readWorkspace(db,'fictional-owner');const before=structuredClone(current);
 const edited=applyCommands(current.state,'fictional-b',[{operation:'update_equipment',entityId:'fictional-alias-b',values:{name:'Fictional B Rename'}}]);assert.deepEqual(current,before);
 assert.throws(()=>writeWorkspace(db,'fictional-owner',edited.state,current.revision),e=>e.status===409);assert.deepEqual(readWorkspace(db,'fictional-owner'),before);
 const stale=structuredClone(current.state);stale.gear[0].category='audio';assert.throws(()=>writeWorkspace(db,'fictional-owner',stale,current.revision),e=>e.status===409);assert.deepEqual(readWorkspace(db,'fictional-owner'),before);
 // A harmless project switch must not block or replace a canonical identity.
 const saved=writeWorkspace(db,'fictional-owner',switchProject(current.state,'fictional-b'),current.revision);assert.equal(saved.state.gear[0].name,'Fictional Shared Lamp');
 const l=active.loan.lines[0];await ok(`/api/inventory/loans/${active.loan.id}/returns`,'POST',{requestId:'fictional-lock-return',lines:[{lineId:l.lineId||l.id,quantity:1}]});
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Returned Lamp',category:'audio'})).status,200);
 current=readWorkspace(db,'fictional-owner');assert.equal(current.state.gear[0].name,'Fictional Returned Lamp');assert.equal(current.state.projects[0].gear[0].category,'audio');
});

test('individual tracking forbids multiple checkout and inventory metadata stays account-private',async t=>{
 const {call,ok,create,loan}=await fixture(t),created=await create({trackingMode:'individual',quantity:1}),id=created.item?.id||created.equipment?.id||created.id;
 assert.ok(id);assert.equal((await call('/api/inventory/loans','POST',loan(id,2,'fictional-individual-two'))).status,409);
 const checked=await ok('/api/inventory/loans','POST',loan(id,1,'fictional-individual-one'));assert.equal(checked.loan.lines[0].outstanding,1);
 assert.equal((await call('/api/inventory/loans','POST',loan(id,1,'fictional-individual-again'))).status,409);
 for(const patch of [{name:'Fictional Rename'},{category:'audio'},{model:'Fictional New Model'},{inventoryCode:'FIC-NEW'},{trackingMode:'bulk'},{trackingMode:'bulk',quantity:2}])assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{revision:created.item.revision,...patch})).status,409,JSON.stringify(patch));
 const foreign=await ok('/api/inventory','GET',undefined,'fictional-other');assert.equal(JSON.stringify(foreign).includes(id),false);
 const foreignLoans=await ok('/api/inventory/loans','GET',undefined,'fictional-other');assert.equal(foreignLoans.loans.length,0);
 assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{name:'Foreign Attempt'},'fictional-other')).status,403);
});

test('organization grants isolate operations, revoke immediately and never grant project catalog custody',async t=>{
 const {db,call,ok,loan}=await fixture(t),org=(await ok('/api/inventory/organizations','POST',{name:'Fictional Organization'})).organization;
 const created=await ok('/api/inventory/items','POST',{name:'Fictional Organization Tripod',category:'tripod',ownership:'organization',organizationId:org.id,trackingMode:'bulk',quantity:3}),id=created.item.id;
 assert.equal((await ok('/api/inventory','GET',undefined,'fictional-operator')).items.length,0);
 await ok(`/api/inventory/organizations/${org.id}/operators`,'POST',{username:'fictional-operator'});
 const inventory=await ok('/api/inventory','GET',undefined,'fictional-operator');assert.equal(inventory.items[0].id,id);assert.equal(inventory.items[0].canManage,true);
 assert.equal((await call(`/api/inventory/organizations/${org.id}/operators`,'POST',{username:'fictional-other'},'fictional-operator')).status,403);
 const borrowed=await ok('/api/inventory/loans','POST',loan(id,1,'fictional-org-borrow'),'fictional-operator');
 assert.equal((await call(`/api/equipment/${id}`,'PUT',{name:'Forbidden project catalog edit',category:'tripod'},'fictional-operator')).status,404);
 const own=emptyWorkspace();own.project.id='fictional-operator-project';writeWorkspace(db,'fictional-operator',own,0);
 assert.equal((await call('/api/projects/fictional-operator-project/equipment-links','POST',{equipmentId:id},'fictional-operator')).status,403);
 assert.equal((await call('/api/inventory/loans','POST',loan(id,1,'fictional-admin-not-operator'),'fictional-admin')).status,403);
 await ok(`/api/inventory/organizations/${org.id}/operators/fictional-operator`,'DELETE');
 assert.equal((await ok('/api/inventory','GET',undefined,'fictional-operator')).items.length,0);
 assert.equal((await ok('/api/inventory/loans','GET',undefined,'fictional-operator')).loans.length,0);
 const line=borrowed.loan.lines[0];assert.equal((await call(`/api/inventory/loans/${borrowed.loan.id}/returns`,'POST',{requestId:'fictional-revoked-return',lines:[{lineId:line.id,quantity:1}]},'fictional-operator')).status,403);
 await ok(`/api/inventory/loans/${borrowed.loan.id}/returns`,'POST',{requestId:'fictional-owner-return',lines:[{lineId:line.id,quantity:1}]});
 // Canonical owner_id remains the account custodian even for organization inventory.
 assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(id).owner_id,'fictional-owner');
});

test('administrator catalog exposes stock summaries but no borrower history and ordinary accounts stay scoped',async t=>{
 const {call,ok,create,loan}=await fixture(t),created=await create({storageLocation:'Fictional Shelf',condition:'Fictional inspected',inventoryCode:'FIC-001'}),id=created.item.id;
 await ok('/api/inventory/loans','POST',{...loan(id,2,'fictional-summary-loan'),borrower:'Fictional Private Borrower'});
 const own=await ok('/api/equipment'),admin=await ok('/api/admin/equipment','GET',undefined,'fictional-admin');
 for(const result of [own,admin]){const row=result.catalog.find(row=>row.id===id);assert.equal(row.quantity,5);assert.equal(row.outstanding,2);assert.equal(row.available,3);assert.equal(row.model,'Fictional Model');assert.equal(row.inventoryCode,'FIC-001');assert.equal(row.storageLocation,'Fictional Shelf');assert.equal(JSON.stringify(result).includes('Fictional Private Borrower'),false);assert.equal(row.organizationId,undefined);}
 assert.equal((await call('/api/admin/equipment','GET',undefined,'fictional-other')).status,403);assert.equal((await ok('/api/equipment','GET',undefined,'fictional-other')).catalog.length,0);
 assert.equal((await call('/api/inventory/loans','POST',loan(id,1,'fictional-actual-admin-denied'),'fictional-admin')).status,403);
});

test('inventory endpoint retains camera category protection from linked project camera setups',async t=>{
 const {db,call}=await fixture(t),state=emptyWorkspace();state.gear=[{id:'fictional-camera-alias',name:'Fictional Camera',category:'camera',owner:'',assignee:'',status:'check'}];state.cameras=[{id:'fictional-camera-position',name:'Fictional Position',role:'',operator:'',body:'Fictional Camera',lens:'',x:50,y:50,refs:[],gearId:'fictional-camera-alias'}];
 writeWorkspace(db,'fictional-owner',state,0);const id=readWorkspace(db,'fictional-owner').state.gear[0].equipmentId;
 assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{revision:0,category:'lighting'})).status,400);assert.equal(db.prepare('SELECT category FROM equipment_items WHERE id=?').get(id).category,'camera');
});

test('legacy catalog and workspace canonical edits invalidate stale inventory revisions atomically',async t=>{
 const {db,call,ok}=await fixture(t),state=emptyWorkspace();state.project.id='fictional-revision-project';state.gear=[{id:'fictional-revision-alias',name:'Fictional Revision Lamp',category:'lighting',owner:'',assignee:'',status:'check'}];writeWorkspace(db,'fictional-owner',state,0);
 const id=readWorkspace(db,'fictional-owner').state.gear[0].equipmentId;
 let snapshot=(await ok('/api/inventory')).items.find(item=>item.id===id);assert.equal(snapshot.revision,0);
 await ok(`/api/equipment/${id}`,'PUT',{name:'Fictional Catalog Revision',category:'lighting'});
 assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{revision:snapshot.revision,name:'Fictional Stale Catalog'})).status,409);
 snapshot=(await ok('/api/inventory')).items.find(item=>item.id===id);assert.equal(snapshot.revision,1);
 let current=readWorkspace(db,'fictional-owner');current.state.gear[0].name='Fictional Workspace Revision';writeWorkspace(db,'fictional-owner',current.state,current.revision);
 assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{revision:snapshot.revision,name:'Fictional Stale Workspace'})).status,409);
 const fresh=(await ok('/api/inventory')).items.find(item=>item.id===id);assert.equal(fresh.revision,2);assert.equal(fresh.name,'Fictional Workspace Revision');
 // Harmless resave/old PUT must not manufacture conflicts.
 current=readWorkspace(db,'fictional-owner');writeWorkspace(db,'fictional-owner',current.state,current.revision);await ok(`/api/equipment/${id}`,'PUT',{name:fresh.name,category:fresh.category});assert.equal((await ok('/api/inventory')).items.find(item=>item.id===id).revision,2);
});

test('loan header numbers remain stable across partial returns, request replay and concurrent issuance',async t=>{
 const {db,ok,create,loan}=await fixture(t),created=await create({quantity:20}),id=created.item.id;
 const request=loan(id,3,'fictional-number-first'),first=await ok('/api/inventory/loans','POST',request),number=first.loan.displayNumber;
 assert.match(number,/^\d{4}-(?:0[1-9]|1[0-2])-001$/);assert.equal(first.loan.numberScope,'fictional-owner');
 const replayed=await ok('/api/inventory/loans','POST',request);assert.equal(replayed.loan.displayNumber,number);
 const line=first.loan.lines[0];for(const key of ['one','two']){const returned=await ok(`/api/inventory/loans/${first.loan.id}/returns`,'POST',{requestId:'fictional-number-return-'+key,lines:[{lineId:line.id,quantity:1}]});assert.equal(returned.loan.displayNumber,number);assert.equal(returned.loan.id,first.loan.id);}
 const concurrent=await Promise.all(['a','b','c'].map(key=>ok('/api/inventory/loans','POST',loan(id,1,'fictional-number-concurrent-'+key))));
 const numbers=concurrent.map(value=>value.loan.displayNumber).sort();assert.equal(new Set(numbers).size,3);assert.deepEqual(numbers.map(value=>Number(value.split('-')[2])),[2,3,4]);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_loan_numbers').get().n,4);
 // A legacy header gets a stable fallback label without assigning/mutating a number.
 db.prepare('DELETE FROM inventory_loan_numbers WHERE loan_id=?').run(first.loan.id);
 const old=(await ok('/api/inventory/loans?status=all')).loans.find(value=>value.id===first.loan.id);assert.equal(old.displayNumber,null);assert.equal(old.numberLabel,'이전 기록');assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_loan_numbers').get().n,3);
 const next=await ok('/api/inventory/loans','POST',loan(id,1,'fictional-number-after-fallback'));assert.match(next.loan.displayNumber,/-005$/);
});

test('multi-item checkout and return roll back every line when one line is invalid',async t=>{
 const {db,call,ok,create,loan}=await fixture(t),a=(await create({quantity:2})).item,b=(await create({quantity:1})).item;
 const mixed={...loan(a.id,1,'fictional-mixed-invalid'),lines:[{equipmentId:a.id,quantity:1},{equipmentId:b.id,quantity:2}]};assert.equal((await call('/api/inventory/loans','POST',mixed)).status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_loans').get().n,0);
 const valid=await ok('/api/inventory/loans','POST',{...mixed,requestId:'fictional-mixed-valid',lines:[{equipmentId:a.id,quantity:2},{equipmentId:b.id,quantity:1}]});assert.equal(valid.loan.lines.length,2);assert.equal(new Set(valid.loan.lines.map(line=>line.equipmentId)).size,2);
 const first=valid.loan.lines.find(line=>line.equipmentId===a.id),second=valid.loan.lines.find(line=>line.equipmentId===b.id),path=`/api/inventory/loans/${valid.loan.id}/returns`;
 assert.equal((await call(path,'POST',{requestId:'fictional-mixed-return-invalid',lines:[{lineId:first.id,quantity:1},{lineId:second.id,quantity:2}]})).status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_returns').get().n,0);
 const returned=await ok(path,'POST',{requestId:'fictional-mixed-return-valid',lines:[{lineId:first.id,quantity:1},{lineId:second.id,quantity:1}]});assert.equal(returned.loan.returns.length,1);assert.equal(returned.loan.returns[0].lines.length,2);
 const zero=(await create({quantity:0})).item;assert.equal(zero.available,0);assert.equal((await call('/api/inventory/loans','POST',loan(zero.id,1,'fictional-zero-stock'))).status,409);
 for(const quantity of [-1,1.5])assert.equal((await call('/api/inventory/items','POST',{name:'Fictional Invalid',category:'lighting',trackingMode:'bulk',quantity})).status,400);
});

test('operator-created organization gear keeps organization owner custody across all APIs and revocation',async t=>{
 const {db,call,ok,loan}=await fixture(t),org=(await ok('/api/inventory/organizations','POST',{name:'Fictional Custody Organization'})).organization;
 await ok(`/api/inventory/organizations/${org.id}/operators`,'POST',{username:'fictional-operator'});
 const created=await ok('/api/inventory/items','POST',{name:'Fictional Operator Registered Light',category:'lighting',ownership:'organization',organizationId:org.id,trackingMode:'bulk',quantity:2},'fictional-operator'),id=created.item.id;
 assert.equal(created.item.ownerId,'fictional-owner');assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(id).owner_id,'fictional-owner');
 const ownerState=emptyWorkspace();ownerState.project.id='fictional-custody-project';writeWorkspace(db,'fictional-owner',ownerState,0);
 const orgRevision=(await ok(`/api/inventory/organizations/${org.id}`)).organization.revision;
 await ok(`/api/inventory/organizations/${org.id}/projects`,'POST',{projectOwnerId:'fictional-owner',projectId:'fictional-custody-project',revision:orgRevision});
 const linked=await ok('/api/projects/fictional-custody-project/equipment-links','POST',{equipmentId:id});assert.equal(linked.equipmentId,id);
 const denied=await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Unauthorized Legacy',category:'lighting'},'fictional-operator');assert.ok([403,404].includes(denied.status));
 const revised=await ok(`/api/inventory/items/${id}`,'PUT',{revision:created.item.revision,model:'Fictional Authorized Model'},'fictional-operator');assert.equal(revised.item.id,id);
 const checked=await ok('/api/inventory/loans','POST',loan(id,1,'fictional-custody-loan'),'fictional-operator');assert.equal(checked.loan.lines[0].equipmentId,id);
 await ok(`/api/inventory/loans/${checked.loan.id}/returns`,'POST',{requestId:'fictional-custody-return',lines:[{lineId:checked.loan.lines[0].id,quantity:1}]});
 await ok(`/api/inventory/organizations/${org.id}/operators/fictional-operator`,'DELETE');
 assert.ok([403,404].includes((await call(`/api/equipment/${id}`,'PUT',{name:'Fictional Revoked Legacy',category:'lighting'},'fictional-operator')).status));
 assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{revision:revised.item.revision,model:'Fictional Revoked Model'},'fictional-operator')).status,403);
 assert.equal((await call('/api/inventory/loans','POST',loan(id,1,'fictional-custody-revoked'),'fictional-operator')).status,403);
 const operatorState=emptyWorkspace();operatorState.project.id='fictional-revoked-project';writeWorkspace(db,'fictional-operator',operatorState,0);assert.equal((await call('/api/projects/fictional-revoked-project/equipment-links','POST',{equipmentId:id},'fictional-operator')).status,403);
 await ok(`/api/equipment/${id}`,'PUT',{name:'Fictional Owner Revised',category:'audio'});
 const current=readWorkspace(db,'fictional-owner');assert.equal(current.state.gear[0].equipmentId,id);assert.equal(current.state.gear[0].name,'Fictional Owner Revised');assert.equal(current.state.gear[0].category,'audio');
 assert.equal((await ok('/api/inventory')).items.find(item=>item.id===id).name,'Fictional Owner Revised');assert.equal((await ok('/api/equipment')).catalog.filter(item=>item.id===id).length,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_items').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_metadata WHERE equipment_id=?').get(id).n,1);
 // An operator's personal asset cannot transfer custody by converting to another account's organization.
 const personal=(await ok('/api/inventory/items','POST',{name:'Fictional Operator Personal Light',category:'lighting'},'fictional-operator')).item;
 await ok(`/api/inventory/organizations/${org.id}/operators`,'POST',{username:'fictional-operator'});
 assert.equal((await call(`/api/inventory/items/${personal.id}`,'PUT',{revision:personal.revision,ownership:'organization',organizationId:org.id},'fictional-operator')).status,403);
 assert.equal(db.prepare('SELECT owner_id FROM equipment_items WHERE id=?').get(personal.id).owner_id,'fictional-operator');
});

test('organization conversion cannot reveal previous private borrower history and issue snapshots remain immutable',async t=>{
 const {db,call,ok,create,loan}=await fixture(t),created=await create({quantity:2,model:'Fictional Original Model',storageLocation:'Fictional Original Shelf',condition:'Fictional Original Condition'}),id=created.item.id;
 const personal=await ok('/api/inventory/loans','POST',{...loan(id,1,'fictional-private-before-conversion'),borrower:'Fictional Private Borrower Sentinel'}),line=personal.loan.lines[0];
 await ok(`/api/inventory/loans/${personal.loan.id}/returns`,'POST',{requestId:'fictional-private-full-return',lines:[{lineId:line.id,quantity:1}]});
 const org=(await ok('/api/inventory/organizations','POST',{name:'Fictional Converted Organization'})).organization;
 await ok(`/api/inventory/items/${id}`,'PUT',{revision:created.item.revision,ownership:'organization',organizationId:org.id,model:'Fictional Revised Model',storageLocation:'Fictional Revised Shelf',condition:'Fictional Revised Condition'});
 await ok(`/api/inventory/organizations/${org.id}/operators`,'POST',{username:'fictional-operator'});
 assert.equal((await ok('/api/inventory','GET',undefined,'fictional-operator')).items.some(item=>item.id===id),true);
 let visible=await ok('/api/inventory/loans?status=all','GET',undefined,'fictional-operator');assert.equal(visible.loans.some(value=>value.id===personal.loan.id),false);assert.equal(JSON.stringify(visible).includes('Fictional Private Borrower Sentinel'),false);
 const issued=(await ok('/api/inventory/loans?status=all')).loans.find(value=>value.id===personal.loan.id).lines[0];assert.equal(issued.model,'Fictional Original Model');assert.equal(issued.storageLocation,'Fictional Original Shelf');assert.equal(issued.condition,'Fictional Original Condition');
 const shared=await ok('/api/inventory/loans','POST',{...loan(id,1,'fictional-org-after-conversion'),borrower:'Fictional Organization Borrower'},'fictional-operator');visible=await ok('/api/inventory/loans?status=all','GET',undefined,'fictional-operator');assert.equal(visible.loans.some(value=>value.id===shared.loan.id),true);assert.equal(visible.loans.some(value=>value.id===personal.loan.id),false);
 assert.equal((await call(`/api/inventory/loans/${personal.loan.id}/returns`,'POST',{requestId:'fictional-private-history-probe',lines:[{lineId:line.id,quantity:1}]},'fictional-operator')).status,403);
 // Pre-scope snapshots stay visible only to the canonical owner after conversion.
 const legacy=JSON.parse(db.prepare('SELECT snapshot FROM inventory_loan_lines WHERE id=?').get(line.id).snapshot);for(const key of ['ownerId','ownership','organizationId'])delete legacy[key];db.prepare('UPDATE inventory_loan_lines SET snapshot=? WHERE id=?').run(JSON.stringify(legacy),line.id);
 assert.equal((await ok('/api/inventory/loans?status=all','GET',undefined,'fictional-operator')).loans.some(value=>value.id===personal.loan.id),false);assert.equal((await ok('/api/inventory/loans?status=all')).loans.some(value=>value.id===personal.loan.id),true);
 // A later second organization grant cannot inherit the first organization's history.
 await ok(`/api/inventory/loans/${shared.loan.id}/returns`,'POST',{requestId:'fictional-org-full-return',lines:[{lineId:shared.loan.lines[0].id,quantity:1}]});
 const second=(await ok('/api/inventory/organizations','POST',{name:'Fictional Second Organization'})).organization,current=(await ok('/api/inventory')).items.find(item=>item.id===id);
 assert.equal((await call(`/api/inventory/items/${id}`,'PUT',{revision:current.revision,organizationId:second.id})).status,403);
 // Simulate a pre-policy transfer in an isolated fixture to retain historical-scope defense coverage.
 db.prepare('UPDATE inventory_metadata SET organization_id=? WHERE equipment_id=?').run(second.id,id);await ok(`/api/inventory/organizations/${second.id}/operators`,'POST',{username:'fictional-other'});
 const moved=await ok('/api/inventory/loans?status=all','GET',undefined,'fictional-other');assert.equal(moved.loans.some(value=>value.id===shared.loan.id),false);assert.equal(JSON.stringify(moved).includes('Fictional Organization Borrower'),false);

});
