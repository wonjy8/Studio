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
test('tables support bounded independent rectangles and circles without changing linked records',async()=>{
 const {resizeLayoutTable}=await import('../src/domain/layout.js');
 const state=emptyWorkspace();const rectangle=addLayoutObject(state,{kind:'table',shape:'rectangle'});
 resizeLayoutTable(state,rectangle.id,180.25,64.75);assert.equal(rectangle.width,180.25);assert.equal(rectangle.height,64.75);
 const circle=addLayoutObject(state,{kind:'table',shape:'circle'});resizeLayoutTable(state,circle.id,160,80);assert.equal(circle.width,160);assert.equal(circle.height,160);
 resizeLayoutTable(state,circle.id,999,0);assert.equal(circle.width,360);assert.equal(circle.height,360);assert.equal(validateWorkspace(state),true);
 assert.throws(()=>resizeLayoutTable(state,rectangle.id,NaN,80));assert.throws(()=>addLayoutObject(state,{kind:'table',shape:'triangle'}));
 for(const patch of [{width:0},{height:361},{shape:'ellipse'},{shape:'circle',width:70,height:80}]){const invalid=structuredClone(state);Object.assign(invalid.layoutObjects[0],patch);assert.equal(validateWorkspace(invalid),false);}
 const legacy=structuredClone(state);for(const key of ['width','height','shape'])delete legacy.layoutObjects[0][key];assert.equal(validateWorkspace(legacy),true);
 const person=addLayoutObject(state,{kind:'person',name:'Fictional person'});person.width=120;assert.equal(validateWorkspace(state),false);
});
test('layout forms show icon choices, whole coordinate values with precise source, table handles and person names',async()=>{
 const {placementForm,positionForm,layoutStage}=await import('../src/features/layout/layout.js');
 const state=emptyWorkspace();const table=addLayoutObject(state,{kind:'table',shape:'circle'});table.x=31.2345;
 const person=addLayoutObject(state,{kind:'person',name:'Fictional cast'});
 const form=placementForm(state,'table');assert.equal((form.match(/type="radio"/g)||[]).length,6);assert.match(form,/name="shape"/);assert.doesNotMatch(form,/<select name="kind"/);
 assert.match(positionForm(table),/data-precise="31.2345" value="31"/);assert.match(positionForm(table),/name="height"[^>]*readonly/);
 const html=layoutStage(state);assert.equal((html.match(/data-resize=/g)||[]).length,8);assert.match(html,/<svg/);assert.match(html,/Fictional cast/);assert.doesNotMatch(html,/<small>사람<\/small>/);
 assert.equal(person.name,'Fictional cast');assert.throws(()=>addLayoutObject(state,{kind:'person'}));
});
test('display geometry keeps large tables and resize handles inside desktop/mobile without mutating source coordinates',async()=>{
 const {layoutItemGeometry}=await import('../src/features/layout/layout.js');
 for(const [stageWidth,stageHeight] of [[900,380],[260,380],[120,100]])for(const shape of ['rectangle','circle'])for(const x of [0,31.2345,100])for(const y of [0,57.5678,100]){
  const item={kind:'table',shape,width:360,height:shape==='circle'?360:220,x,y};const before=structuredClone(item);
  const geometry=layoutItemGeometry(item,stageWidth,stageHeight);
  assert.ok(geometry.left-geometry.width/2>=9.999);assert.ok(geometry.left+geometry.width/2<=stageWidth-9.999);
  assert.ok(geometry.top-geometry.height/2>=9.999);assert.ok(geometry.top+geometry.height/2<=stageHeight-9.999);
  if(shape==='circle')assert.equal(geometry.width,geometry.height);
  assert.deepEqual(item,before);
 }
 const small=layoutItemGeometry({kind:'table',width:120,height:80,x:0,y:100},500,380);
 const large=layoutItemGeometry({kind:'table',width:360,height:240,x:0,y:100},500,380);
 assert.equal(small.left-small.width/2,10);assert.equal(large.left-large.width/2,10);
 assert.equal(small.top+small.height/2,370);assert.equal(large.top+large.height/2,370);
});
test('mobile table fitting respects 48px axes while preserving circle shape and stored geometry',async()=>{
 const {layoutItemGeometry}=await import('../src/features/layout/layout.js');
 for(const [width,height,expectedWidth,expectedHeight] of [[360,48,240,48],[48,360,48,240],[360,360,240,240]]){
  const item={kind:'table',shape:width===height?'circle':'rectangle',width,height,x:31.23456,y:55.6789},before=structuredClone(item);
  const geometry=layoutItemGeometry(item,260,260);assert.equal(geometry.width,expectedWidth);assert.equal(geometry.height,expectedHeight);assert.deepEqual(item,before);
 }
});
