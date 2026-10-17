import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects,switchProject} from '../src/domain/projects.js';
import {applyCommands} from '../src/domain/commands.js';
import {readWorkspace,writeWorkspace} from '../server/workspace-service.js';

test('canonical inventory survives project switches and stale usage snapshots; conflicts reject atomically',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-equipment-'));const {server,db}=await createApp({dir,origin:'http://localhost',secure:false});
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','unused-test-hash');
 let state=prepareProjects(emptyWorkspace());state.project.id='a';const other=prepareProjects(emptyWorkspace());other.project.id='b';delete other.projects;state.projects=[other];
 state.gear=[{id:'ga',name:'Fictional Light',category:'lighting',owner:'',assignee:'',status:'check'}];
 const input=structuredClone(state);writeWorkspace(db,'fictional-owner',state,0);assert.deepEqual(state,input);
 let current=readWorkspace(db,'fictional-owner');const equipmentId=current.state.gear[0].equipmentId;
 current.state.projects[0].gear=[{...current.state.gear[0],id:'gb'}];writeWorkspace(db,'fictional-owner',current.state,1);
 current=readWorkspace(db,'fictional-owner');current.state.gear[0].name='Fictional Revised';const retainedClient=structuredClone(current.state);writeWorkspace(db,'fictional-owner',current.state,2);
 // Do not reload: the UI still holds an inactive old usage after the first save.
 writeWorkspace(db,'fictional-owner',switchProject(retainedClient,'b'),3);
 current=readWorkspace(db,'fictional-owner');assert.equal(current.state.gear[0].name,'Fictional Revised');assert.equal(current.state.projects[0].gear[0].name,'Fictional Revised');
 // Simulate a canonical API edit after a workspace snapshot was read.
 const stale=structuredClone(current.state);db.prepare('UPDATE equipment_items SET name=? WHERE id=?').run('Fictional Catalog Edit',equipmentId);
 writeWorkspace(db,'fictional-owner',switchProject(stale,'b'),4);
 current=readWorkspace(db,'fictional-owner');assert.equal(current.state.gear[0].name,'Fictional Catalog Edit');assert.equal(current.state.projects[0].gear[0].name,'Fictional Catalog Edit');
 const before=structuredClone(current.state);const result=applyCommands(current.state,'a',[{operation:'update_equipment',entityId:'ga',values:{name:'Fictional Inactive Edit',category:'audio'}}]);assert.deepEqual(current.state,before);assert.equal(result.state.project.id,'b');assert.equal(result.state.gear[0].name,'Fictional Inactive Edit');assert.equal(result.state.projects[0].gear[0].name,'Fictional Inactive Edit');
 const canonicalResponse=writeWorkspace(db,'fictional-owner',result.state,5);assert.equal(canonicalResponse.state.gear[0].equipmentBaseName,'Fictional Inactive Edit');assert.equal(canonicalResponse.state.projects[0].gear[0].name,'Fictional Inactive Edit');current=readWorkspace(db,'fictional-owner');assert.equal(current.state.gear[0].category,'audio');assert.equal(current.state.projects[0].gear[0].category,'audio');
 const staleEdit=structuredClone(retainedClient);staleEdit.gear[0].name='Fictional Stale Explicit';assert.throws(()=>writeWorkspace(db,'fictional-owner',staleEdit,6),e=>e.status===409);
 current.state.gear[0].name='Fictional Conflict One';current.state.projects[0].gear[0].name='Fictional Conflict Two';assert.throws(()=>writeWorkspace(db,'fictional-owner',current.state,6),e=>e.status===409);assert.equal(readWorkspace(db,'fictional-owner').revision,6);assert.equal(db.prepare('SELECT name FROM equipment_items WHERE id=?').get(equipmentId).name,'Fictional Inactive Edit');
});
