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
