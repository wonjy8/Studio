import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,validateWorkspace} from '../src/domain/workspace.js';
import {prepareProjects,addProject,switchProject} from '../src/domain/projects.js';
import {applyCommands} from '../src/domain/commands.js';
test('shared commands preserve inactive projects and synchronize shoot schedule without mutating input',()=>{
 let initial=prepareProjects(emptyWorkspace());const first=initial.project.id;
 initial=addProject(initial,{name:'Fictional second',icon:'camera',color:'blue'},'second');
 const before=structuredClone(initial);let result=applyCommands(initial,first,[{operation:'add_shoot',values:{name:'Fictional shoot',time:'10:00',location:'Set A'}},{operation:'add_member',values:{name:'Fictional crew'}}]);
 assert.deepEqual(initial,before);assert.equal(result.state.project.id,'second');
 let selected=switchProject(result.state,first);const shoot=selected.contents[0];assert.equal(selected.schedule[0][2],shoot.id);
 result=applyCommands(result.state,first,[{operation:'update_shoot',entityId:shoot.id,values:{name:'Fictional revised',time:'11:00'}},{operation:'add_equipment',values:{name:'Fictional tripod',category:'tripod'}}]);
 selected=switchProject(result.state,first);assert.equal(selected.schedule[0][0],'11:00');assert.equal(selected.schedule[0][1],'Fictional revised');assert.equal(selected.gear[0].category,'tripod');assert.equal(validateWorkspace(result.state),true);
 assert.throws(()=>applyCommands(initial,'missing',[{operation:'update_project',values:{name:'Bad'}}]));
 assert.throws(()=>applyCommands(initial,first,[{operation:'update_shoot',entityId:'missing',values:{name:'Bad'}}]));
 assert.throws(()=>applyCommands(initial,first,[{operation:'update_project',values:{password:'bad'}}]));assert.deepEqual(initial,before);
});
test('renaming connected members and equipment keeps dependent labels consistent',()=>{
 let state=prepareProjects(emptyWorkspace());state.members.push({id:'person',name:'Fictional A',role:'Crew',call:''});
 state.gear.push({id:'camera-gear',name:'Fictional body',category:'camera',owner:'Fictional A',assignee:'Fictional A',status:'check'});
 state.cameras.push({id:'camera',name:'CAM A',role:'',operator:'Fictional A',body:'Fictional body',lens:'',gearId:'camera-gear',x:50,y:50,refs:[]});
 state.layoutObjects.push({id:'person-layout',kind:'person',memberId:'person',name:'Fictional A',x:20,y:20,rotation:0});
 state=applyCommands(state,state.project.id,[{operation:'update_member',entityId:'person',values:{name:'Fictional B'}},{operation:'update_equipment',entityId:'camera-gear',values:{name:'Fictional new body'}}]).state;
 assert.equal(state.gear[0].owner,'Fictional B');assert.equal(state.gear[0].assignee,'Fictional B');assert.equal(state.cameras[0].operator,'Fictional B');assert.equal(state.cameras[0].body,'Fictional new body');assert.equal(state.layoutObjects[0].name,'Fictional B');assert.equal(validateWorkspace(state),true);
});
test('equipment commands use project-local nullable member links and preserve explicit manual unlink text',()=>{
 let state=prepareProjects(emptyWorkspace());const projectId=state.project.id;state.members=[{id:'local-owner',name:'Fictional Owner',role:'',call:''},{id:'local-assignee',name:'Fictional Assignee',role:'',call:''}];state.gear=[{id:'gear',name:'Fictional Equipment',category:'other',status:'check',owner:'Legacy Owner',assignee:'Legacy Assignee'}];const before=structuredClone(state);
 const update=values=>{state=applyCommands(state,projectId,[{operation:'update_equipment',entityId:'gear',values}]).state;return state.gear[0];};
 let gear=update({ownerMemberId:'local-owner',owner:'Ignored manual owner',assigneeMemberId:'local-assignee',assignee:'Ignored manual assignee'});assert.equal(gear.owner,'Fictional Owner');assert.equal(gear.assignee,'Fictional Assignee');assert.deepEqual(before.gear[0].owner,'Legacy Owner');
 gear=update({owner:'Text only cannot replace linked identity',assignee:'Also ignored'});assert.equal(gear.owner,'Fictional Owner');assert.equal(gear.assignee,'Fictional Assignee');
 gear=update({ownerMemberId:null,owner:'Fictional Manual Owner',assigneeMemberId:null,assignee:'Fictional Manual Assignee'});assert.equal(gear.owner,'Fictional Manual Owner');assert.equal(gear.assignee,'Fictional Manual Assignee');gear=update({status:'ready'});assert.equal(gear.owner,'Fictional Manual Owner');gear=update({ownerMemberId:null,assigneeMemberId:null});assert.equal(gear.owner,'Fictional Manual Owner');assert.equal(gear.assignee,'Fictional Manual Assignee');
 update({ownerMemberId:'local-owner',assigneeMemberId:'local-assignee'});gear=update({ownerMemberId:null,assigneeMemberId:null});assert.equal(gear.owner,'');assert.equal(gear.assignee,'');
 const initial=applyCommands(state,projectId,[{operation:'add_equipment',values:{name:'Fictional Initial',ownerMemberId:null,owner:'Fictional Initial Owner',assigneeMemberId:null,assignee:'Fictional Initial Assignee'}}]).state.gear.at(-1);assert.equal(initial.owner,'Fictional Initial Owner');assert.equal(initial.assignee,'Fictional Initial Assignee');
 const other=emptyWorkspace();other.project.id='other-project';other.members=[{id:'foreign-member',name:'Private Other Member',role:'',call:''}];state.projects=[other];
 for(const bad of ['foreign-member','missing','',false,{},0,undefined])for(const field of ['ownerMemberId','assigneeMemberId']){const saved=structuredClone(state);assert.throws(()=>applyCommands(state,projectId,[{operation:'update_equipment',entityId:'gear',values:{[field]:bad}}]));assert.deepEqual(state,saved);}
 const saved=structuredClone(state);assert.throws(()=>applyCommands(state,projectId,[{operation:'add_equipment',values:{name:'Invalid New',ownerMemberId:'foreign-member'}}]));assert.deepEqual(state,saved);assert.equal(validateWorkspace(state),true);
});
test('member rename follows explicit equipment identity and preserves same-name manual assignments',()=>{
 const state=prepareProjects(emptyWorkspace());state.members=[{id:'renamed',name:'Fictional Shared Name',role:'',call:''},{id:'other',name:'Fictional Shared Name',role:'',call:''}];
 const gear=(id,extra)=>({id,name:id,owner:'Fictional Shared Name',assignee:'Fictional Shared Name',category:'other',status:'check',...extra});
 state.gear=[gear('correct',{ownerMemberId:'renamed',assigneeMemberId:'renamed'}),gear('manual',{ownerMemberId:null,assigneeMemberId:null}),gear('different',{ownerMemberId:'other',assigneeMemberId:'other'}),gear('legacy',{})];const before=structuredClone(state);
 const result=applyCommands(state,state.project.id,[{operation:'update_member',entityId:'renamed',values:{name:'Fictional Renamed Person'}}]).state;
 for(const field of ['owner','assignee']){assert.equal(result.gear[0][field],'Fictional Renamed Person');assert.equal(result.gear[1][field],'Fictional Shared Name');assert.equal(result.gear[2][field],'Fictional Shared Name');assert.equal(result.gear[3][field],'Fictional Renamed Person');}assert.deepEqual(state,before);assert.equal(validateWorkspace(result),true);
});
