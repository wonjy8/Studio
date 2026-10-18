import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server/index.js';
import {equipmentSharingRoutes} from '../server/equipment-sharing.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {writeWorkspace} from '../server/workspace-service.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-fictional-sharing-race-')),{db}=await createApp({dir,origin:'http://localhost',secure:false});
 t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
 for(const id of ['fictional-owner','fictional-next'])db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'fictional-unused-hash');
 const state=emptyWorkspace();state.project.id='fictional-project';writeWorkspace(db,'fictional-owner',state,0);
 db.prepare('INSERT INTO equipment_items VALUES(?,?,?,?)').run('fictional-item','fictional-owner','Fictional camera','camera');
 db.prepare('INSERT INTO inventory_metadata VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('fictional-item','','','individual',1,'','','','personal',null,1);
 return db;
}
async function grantWhileBodyWaits(db,change){
 let release,started;const entered=new Promise(resolve=>started=resolve),body=new Promise(resolve=>release=resolve);let response;
 const pending=equipmentSharingRoutes(db)({path:'/api/equipment/fictional-item/project-approvals',req:{method:'POST'},session:{user_id:'fictional-owner'},json:(status,value)=>response={status,value},readJson:()=>{started();return body;}});
 await entered;change();release({projectOwnerId:'fictional-owner',projectId:'fictional-project'});await pending;return response;
}
for(const scenario of ['owner transfer','organization ownership','project scope','removed item'])test(`personal grant rechecks ${scenario} after deferred request body`,async t=>{
 const db=await fixture(t);const response=await grantWhileBodyWaits(db,()=>{
  if(scenario==='owner transfer')db.prepare('UPDATE equipment_items SET owner_id=? WHERE id=?').run('fictional-next','fictional-item');
  if(scenario==='organization ownership')db.prepare("UPDATE inventory_metadata SET ownership='organization' WHERE equipment_id=?").run('fictional-item');
  if(scenario==='project scope')db.prepare('INSERT INTO equipment_project_scope VALUES(?,?,?,?,?)').run('fictional-item','fictional-owner','fictional-project',null,'Fictional manual owner');
  if(scenario==='removed item'){db.prepare('DELETE FROM inventory_metadata WHERE equipment_id=?').run('fictional-item');db.prepare('DELETE FROM equipment_items WHERE id=?').run('fictional-item');}
 });assert.equal(response.status,403);assert.equal(response.value.error,'Personal equipment owner required');assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_project_grants').get().n,0);
});
test('unchanged personal owner grants once and rechecks project membership after body wait',async t=>{
 const db=await fixture(t);assert.equal((await grantWhileBodyWaits(db,()=>{})).status,200);assert.equal((await grantWhileBodyWaits(db,()=>{})).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_project_grants').get().n,1);
 db.prepare('DELETE FROM equipment_project_grants').run();const response=await grantWhileBodyWaits(db,()=>db.prepare('DELETE FROM workspaces WHERE user_id=?').run('fictional-owner'));assert.equal(response.status,403);assert.equal(db.prepare('SELECT COUNT(*) n FROM equipment_project_grants').get().n,0);
});
