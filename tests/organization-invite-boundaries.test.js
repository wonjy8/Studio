import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {orgRole} from '../server/inventory-organizations.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-invite-boundaries-fictional-')),origin='http://localhost',{server,db}=await createApp({dir,origin,secure:false});
 for(const id of ['owner','site','target','other']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,'fictional-'+id,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(id),id,Date.now()+600000);}
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id','site')").run();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const call=async(user,path,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}`+path,{method,headers:{Origin:origin,Cookie:'studio_session='+user,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};const ok=async(...args)=>{const r=await call(...args);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.body;};
 const org=(await ok('owner','/api/inventory/organizations','POST',{name:'Fictional Boundary Organization'})).organization,path=`/api/admin/organizations/${org.id}/invitations`;
 return {db,call,ok,org,path};
}

test('site invite rejects forged provenance and unknown methods without mutating authority or organization revision',async t=>{
 const {db,call,ok,org,path}=await fixture(t);
 for(const extra of [{siteIssued:true},{inviter_id:'owner'},{provenance:'site'},{role:'owner'},{role:'OWNER'}]){
  assert.equal((await call('site',path,'POST',{revision:0,userId:'target',role:'viewer',...extra})).status,400);
 }
 for(const [endpoint,method,body] of [[path,'PUT',{revision:0,userId:'target',role:'admin'}],[path,'DELETE',{revision:0}],['/api/admin/organizations','POST',{name:'Fictional Forbidden'}],[`/api/admin/organizations/${org.id}/members/target`,'PUT',{role:'owner',revision:0}]])assert.equal((await call('site',endpoint,method,body)).status,404);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_invitations').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_site_invitations').get().n,0);assert.equal((await ok('site',path)).revision,0);assert.equal(orgRole(db,'site',org.id),null);
});

test('concurrent stale site invitations create one provenance row and provenance mismatch cannot grant a role',async t=>{
 const {db,call,ok,org,path}=await fixture(t),results=await Promise.all(['target','other'].map(userId=>call('site',path,'POST',{revision:0,userId,role:'operator'})));
 assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_invitations').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_site_invitations').get().n,1);assert.equal((await ok('site',path)).revision,1);
 const invitation=results.find(result=>result.status===201).body.invitation,target=invitation.userId;
 db.prepare('UPDATE inventory_site_invitations SET inviter_id=? WHERE invitation_id=?').run('owner',invitation.id);
 assert.equal((await call(target,`/api/inventory/invitations/${invitation.id}/accept`,'POST',{revision:1})).status,403);assert.equal(orgRole(db,target,org.id),null);assert.equal(db.prepare('SELECT status FROM inventory_invitations WHERE id=?').get(invitation.id).status,'pending');
});

test('ordinary invitation issued by a later site administrator retains organization authority requirements',async t=>{
 const {db,call,ok,org,path}=await fixture(t);
 // This is an ordinary organization invitation with no site provenance.
 db.prepare("INSERT INTO inventory_memberships VALUES(?,?,'admin',1)").run(org.id,'site');
 const issued=await ok('site',`/api/inventory/organizations/${org.id}/invitations`,'POST',{revision:0,userId:'target',role:'viewer'});assert.equal(db.prepare('SELECT invitation_id FROM inventory_site_invitations WHERE invitation_id=?').get(issued.invitation.id),undefined);
 db.prepare("UPDATE inventory_memberships SET active=0 WHERE org_id=? AND user_id='site'").run(org.id);
 assert.equal((await call('target',`/api/inventory/invitations/${issued.invitation.id}/accept`,'POST',{revision:1})).status,403);assert.equal(orgRole(db,'target',org.id),null);
 assert.equal((await call('site',path+'/'+issued.invitation.id,'DELETE',{revision:1})).status,404);assert.equal(db.prepare('SELECT status FROM inventory_invitations WHERE id=?').get(issued.invitation.id).status,'pending');
});
