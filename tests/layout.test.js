import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,validateWorkspace} from '../src/domain/workspace.js';
import {prepareProjects,addProject,switchProject} from '../src/domain/projects.js';
import {prepareLayout,addCamera,addLayoutObject,moveLayoutItem,removeLayoutItem} from '../src/domain/layout.js';
test('legacy cameras reuse inventory and preparation is repeatable without data loss',()=>{
 const state=emptyWorkspace();delete state.layoutObjects;
 state.gear.push({id:'gear',name:'Fictional camera',owner:'',assignee:'',status:'ready'});
 state.cameras.push({id:'camera',name:'CAM A',body:'Fictional camera',lens:'',operator:'',role:'Wide',x:12,y:62,refs:[]});
 assert.equal(validateWorkspace(state),true);prepareLayout(state);const before=structuredClone(state);prepareLayout(state);
 assert.deepEqual(state,before);assert.equal(state.gear.length,1);assert.equal(state.cameras[0].gearId,'gear');assert.equal(state.gear[0].category,'camera');assert.equal(state.gear[0].status,'ready');assert.equal(validateWorkspace(state),true);
});
test('camera inventory and linked scene objects survive project switches; removal retains inventory',()=>{
 let state=prepareProjects(emptyWorkspace());
 const camera=addCamera(state,{name:'CAM A',body:'Fictional camera'});
 addCamera(state,{name:'CAM B',gearId:camera.gearId});assert.equal(state.gear.length,1);
 for(const category of ['lighting','tripod','sd'])state.gear.push({id:category,name:category,category,owner:'',assignee:'',status:'check'});
 state.members.push({id:'member',name:'Fictional performer',role:'Cast',call:''});
 for(const kind of ['table','chair','stage','other'])addLayoutObject(state,{kind});
 const person=addLayoutObject(state,{kind:'person',memberId:'member'});
 const light=addLayoutObject(state,{kind:'equipment',gearId:'lighting'});
 moveLayoutItem(state,person.id,130,-10,90);assert.equal(person.x,100);assert.equal(person.y,0);assert.equal(person.rotation,90);
 assert.equal(validateWorkspace(state),true);
 const id=state.project.id;state=addProject(state,{name:'Fictional B',icon:'camera',color:'blue'},'other');assert.equal(state.layoutObjects.length,0);
 state=switchProject(state,id);assert.equal(state.layoutObjects.length,6);assert.equal(state.layoutObjects.find(x=>x.id===person.id).rotation,90);
 removeLayoutItem(state,light.id);removeLayoutItem(state,camera.id);assert.equal(state.gear.length,4);assert.equal(state.members.length,1);assert.equal(validateWorkspace(state),true);
});
test('server rejects invalid placement positions, categories and cross-project references',()=>{
 const state=emptyWorkspace();const item=addLayoutObject(state,{kind:'table'});
 for(const patch of [{x:NaN},{x:101},{y:-1},{rotation:361},{kind:'__proto__'},{gearId:'foreign'},{memberId:'foreign'}]){
 const invalid=structuredClone(state);Object.assign(invalid.layoutObjects[0],patch);assert.equal(validateWorkspace(invalid),false,JSON.stringify(patch));
 }
 assert.throws(()=>addLayoutObject(state,{kind:'equipment',gearId:'foreign'}));
 assert.throws(()=>addLayoutObject(state,{kind:'person',memberId:'foreign'}));
 assert.throws(()=>addCamera(state,{name:'CAM',gearId:'foreign'}));
 assert.throws(()=>moveLayoutItem(state,item.id,NaN,50));
 const camera=addCamera(state,{name:'CAM'});camera.gearId='foreign';assert.equal(validateWorkspace(state),false);
});
