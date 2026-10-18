import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {orgRole} from '../server/inventory-organizations.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-site-org-fictional-')),origin='http://localhost';const {db,server}=await createApp({dir,origin,secure:false});
 for(const id of ['fictional-site-admin','fictional-owner','fictional-target','fictional-other','fictional-successor']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(id),id,Date.now()+600000);}
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id','fictional-site-admin')").run();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const call=async(user,path,method='GET',data)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}`+path,{method,headers:{Origin:origin,...(user?{Cookie:'studio_session='+user}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json()};};
 const ok=async(...args)=>{const r=await call(...args);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.body;};
 const org=(await ok('fictional-owner','/api/inventory/organizations','POST',{name:'Fictional Private Organization',description:'PRIVATE_ORG_DESCRIPTION_SENTINEL'})).organization;
 const path=`/api/admin/organizations/${org.id}/invitations`;const revision=async()=>(await ok('fictional-site-admin',path)).revision;
 return {db,call,ok,org,path,revision};
}
test('site organization invitations are pending, minimal, scoped and do not grant administrator membership',async t=>{
 const {db,call,ok,org,path,revision}=await fixture(t);
 assert.equal((await call(null,'/api/admin/organizations')).status,401);assert.equal((await call('fictional-owner','/api/admin/organizations')).status,403);
 const privateItem=(await ok('fictional-owner','/api/inventory/items','POST',{name:'PRIVATE_EQUIPMENT_SENTINEL',category:'other',ownership:'organization',organizationId:org.id})).item;
 await ok('fictional-owner','/api/inventory/loans','POST',{requestId:'fictional-private-loan',borrower:'PRIVATE_BORROWER_SENTINEL',dueAt:new Date(Date.now()+600000).toISOString(),lines:[{equipmentId:privateItem.id,quantity:1}]});
 const list=await ok('fictional-site-admin','/api/admin/organizations');assert.deepEqual(list.organizations,[{id:org.id,name:org.name,revision:0}]);assert.equal(JSON.stringify(list).includes('PRIVATE_'),false);
 const issued=await ok('fictional-site-admin',path,'POST',{userId:'fictional-target',role:'admin',revision:0});assert.equal(issued.pending,true);assert.equal(orgRole(db,'fictional-target',org.id),null);assert.equal(orgRole(db,'fictional-site-admin',org.id),null);
 const adminInventory=await ok('fictional-site-admin','/api/inventory');assert.deepEqual(adminInventory.organizations,[]);assert.deepEqual(adminInventory.items,[]);assert.equal((await call('fictional-site-admin','/api/inventory/items/'+privateItem.id,'PUT',{revision:privateItem.revision,name:'Unauthorized change'})).status,403);assert.equal((await call('fictional-site-admin','/api/inventory/loans','POST',{requestId:'fictional-admin-no-loan',borrower:'Fictional Borrower',dueAt:new Date(Date.now()+600000).toISOString(),lines:[{equipmentId:privateItem.id,quantity:1}]})).status,403);assert.deepEqual((await ok('fictional-site-admin','/api/inventory/loans?status=all')).loans,[]);assert.equal((await call('fictional-site-admin',`/api/inventory/organizations/${org.id}`)).status,404);
 const pending=await ok('fictional-site-admin',path);assert.deepEqual(pending.invitations,[{id:issued.invitation.id,username:'fictional-target',role:'admin',revision:1}]);
 assert.equal((await call('fictional-site-admin',path,'POST',{userId:'fictional-other',role:'owner',revision:await revision()})).status,400);
 assert.equal((await call('fictional-site-admin',path,'POST',{userId:'fictional-other',role:'viewer',revision:0})).status,409);
 assert.equal((await call('fictional-site-admin',path,'POST',{userId:'fictional-target',role:'viewer',revision:await revision()})).status,409);
 assert.equal((await call('fictional-other',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1})).status,404);
 await ok('fictional-target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1});assert.equal(orgRole(db,'fictional-target',org.id),'admin');assert.equal(orgRole(db,'fictional-site-admin',org.id),null);
 const ownerRevoked=await ok('fictional-site-admin',path,'POST',{userId:'fictional-other',role:'viewer',revision:await revision()});await ok('fictional-owner',`/api/inventory/organizations/${org.id}/invitations/${ownerRevoked.invitation.id}`,'DELETE',{revision:await revision()});assert.equal((await call('fictional-other',`/api/inventory/invitations/${ownerRevoked.invitation.id}/accept`,'POST',{revision:1})).status,409);
});
test('site-issued invitation authority is rechecked and organization-issued invitations cannot be cancelled through site route',async t=>{
 const {db,call,ok,org,path,revision}=await fixture(t);
 const ordinary=await ok('fictional-owner',`/api/inventory/organizations/${org.id}/invitations`,'POST',{userId:'fictional-target',role:'viewer',revision:0});assert.deepEqual((await ok('fictional-site-admin',path)).invitations,[]);
 assert.equal((await call('fictional-site-admin',path+'/'+ordinary.invitation.id,'DELETE',{revision:await revision()})).status,404);
 await ok('fictional-owner',`/api/inventory/organizations/${org.id}/invitations/${ordinary.invitation.id}`,'DELETE',{revision:await revision()});
 const issued=await ok('fictional-site-admin',path,'POST',{userId:'fictional-target',role:'operator',revision:await revision()});
 db.prepare("UPDATE site_settings SET value='fictional-successor' WHERE key='admin_user_id'").run();
 assert.equal((await call('fictional-target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1})).status,403);assert.equal(orgRole(db,'fictional-target',org.id),null);
 assert.equal((await call('fictional-site-admin',path)).status,403);
 const current=(await ok('fictional-successor',path)).revision;await ok('fictional-successor',path+'/'+issued.invitation.id,'DELETE',{revision:current});
 assert.equal((await call('fictional-target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1})).status,409);
 // Organization-owner invitations still rely on organization authority, regardless of site administrator changes.
 const ordinary2=await ok('fictional-owner',`/api/inventory/organizations/${org.id}/invitations`,'POST',{userId:'fictional-target',role:'viewer',revision:(await ok('fictional-successor',path)).revision});
 await ok('fictional-target',`/api/inventory/invitations/${ordinary2.invitation.id}/accept`,'POST',{revision:1});assert.equal(orgRole(db,'fictional-target',org.id),'viewer');
});
test('site-issued invitations retain expiry, revocation, availability and exact-account validation',async t=>{
 const {db,call,ok,path,revision}=await fixture(t);
 assert.equal((await call('fictional-site-admin',path,'POST',{username:'fictional-target',role:'operator',revision:0})).status,400);
 assert.equal((await call('fictional-site-admin',path,'POST',{userId:'fictional-missing',role:'operator',revision:0})).status,400);
 let issued=await ok('fictional-site-admin',path,'POST',{userId:'fictional-target',role:'viewer',revision:0});
 db.prepare('UPDATE inventory_invitations SET expires_at=0 WHERE id=?').run(issued.invitation.id);assert.equal((await call('fictional-target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1})).status,409);
 issued=await ok('fictional-site-admin',path,'POST',{userId:'fictional-target',role:'viewer',revision:await revision()});
 db.prepare('INSERT INTO account_status VALUES(?,?,?)').run('fictional-site-admin',Date.now()+600000,null);
 assert.equal((await call('fictional-target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1})).status,403);
 assert.equal((await call('fictional-site-admin',path,'DELETE',{revision:0})).status,401);
});

test('site administrators cannot self-invite or accept legacy self-issued invitations',async t=>{
 const {db,call,ok,org,path,revision}=await fixture(t);
 const initialRevision=await revision();
 for(const role of ['admin','operator','viewer']){
  assert.equal((await call('fictional-site-admin',path,'POST',{userId:'fictional-site-admin',role,revision:initialRevision})).status,403);
  for(const forged of [{inviterId:'fictional-owner'},{inviter_id:'fictional-owner'},{target:'fictional-target'},{user_id:'fictional-target'},{siteIssued:false}])assert.equal((await call('fictional-site-admin',path,'POST',{userId:'fictional-site-admin',role,revision:initialRevision,...forged})).status,400);
 }
 assert.equal(await revision(),initialRevision);assert.equal(db.prepare('SELECT count(*) n FROM inventory_invitations').get().n,0);assert.equal(orgRole(db,'fictional-site-admin',org.id),null);
 const now=Date.now();db.prepare('INSERT INTO inventory_invitations VALUES(?,?,?,?,?,?,?,?,?)').run('fictional-old-self-invite',org.id,'fictional-site-admin','fictional-site-admin','admin','pending',1,now,now+600000);db.prepare('INSERT INTO inventory_site_invitations VALUES(?,?)').run('fictional-old-self-invite','fictional-site-admin');
 const before=db.prepare('SELECT * FROM inventory_invitations WHERE id=?').get('fictional-old-self-invite');
 assert.equal((await call('fictional-site-admin','/api/inventory/invitations/fictional-old-self-invite/accept','POST',{revision:1})).status,403);
 assert.deepEqual(db.prepare('SELECT * FROM inventory_invitations WHERE id=?').get(before.id),before);assert.equal(await revision(),initialRevision);assert.equal(orgRole(db,'fictional-site-admin',org.id),null);
 // Even preexisting legitimate organization roles must not be overwritten through this stale site-issued invitation.
 for(const role of ['owner','admin']){
  db.prepare('INSERT INTO inventory_memberships VALUES(?,?,?,1) ON CONFLICT(org_id,user_id) DO UPDATE SET role=excluded.role').run(org.id,'fictional-site-admin',role);
  assert.equal((await call('fictional-site-admin','/api/inventory/invitations/fictional-old-self-invite/accept','POST',{revision:1})).status,403);assert.equal(orgRole(db,'fictional-site-admin',org.id),role);assert.equal(await revision(),initialRevision);
 }
 // Other recipients retain the pending acceptance flow.
 const issued=await ok('fictional-site-admin',path,'POST',{userId:'fictional-target',role:'operator',revision:initialRevision});await ok('fictional-target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1});assert.equal(orgRole(db,'fictional-target',org.id),'operator');assert.equal(orgRole(db,'fictional-site-admin',org.id),'admin');
});
