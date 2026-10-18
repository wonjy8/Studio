import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,validateWorkspace} from '../src/domain/workspace.js';
import {addLayoutObject,lightingTypes,setLightingType,removeLayoutItem} from '../src/domain/layout.js';
import {layoutStage,placementForm,positionForm} from '../src/features/layout/layout.js';
test('lighting variants reuse registered inventory and preserve valid scene data',()=>{
 const state=emptyWorkspace();state.gear.push({id:'light',name:'Registered light',category:'lighting',owner:'',assignee:'',status:'check'});
 for(const lightType of Object.keys(lightingTypes)){
  const item=addLayoutObject(state,{kind:'lighting',gearId:'light',lightType,color:'blue'});
  assert.equal(state.gear.find(g=>g.id===item.gearId).category,'lighting');
  assert.equal(item.name,'Registered light');assert.equal(validateWorkspace(state),true);
 }
 const first=state.layoutObjects[0],count=state.gear.length;
 const copy=addLayoutObject(state,{kind:'lighting',gearId:first.gearId,lightType:'softbox'});
 assert.equal(state.gear.length,count);assert.equal(copy.gearId,first.gearId);
 setLightingType(state,copy.id,'octabox');assert.equal(copy.lightType,'octabox');
 removeLayoutItem(state,copy.id);assert.equal(state.gear.length,count);
 assert.match(placementForm(state,'lighting'),/name="lightType"/);assert.match(positionForm(first),/name="lightType"/);
 assert.doesNotMatch(layoutStage(state),/↻/);
});
test('invalid lighting does not mutate inventory or bypass workspace validation',()=>{
 const state=emptyWorkspace();
 for(const fields of [{kind:'lighting',lightType:'bogus'},{kind:'lighting',gearId:'foreign'},{kind:'lighting',name:'x'.repeat(2001)},{kind:'table',lightType:'panel'}])assert.throws(()=>addLayoutObject(state,fields));
 assert.equal(state.gear.length,0);assert.equal(state.layoutObjects.length,0);
 assert.throws(()=>addLayoutObject(state,{kind:'lighting'}));
 state.gear.push({id:'light',name:'Registered light',category:'lighting',owner:'',assignee:'',status:'check'});
 const item=addLayoutObject(state,{kind:'lighting',gearId:'light'});assert.equal(item.lightType,'panel');
 for(const patch of [{lightType:'bogus'},{lightType:undefined},{gearId:'foreign'},{kind:'other'}]){const bad=structuredClone(state);Object.assign(bad.layoutObjects[0],patch);assert.equal(validateWorkspace(bad),false);}
 state.gear[0].category='camera';assert.equal(validateWorkspace(state),false);
 assert.throws(()=>addLayoutObject(state,{kind:'lighting',gearId:item.gearId}));
});
