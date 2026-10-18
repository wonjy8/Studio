import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,validateWorkspace} from '../src/domain/workspace.js';
import {addLayoutObject,resizeLayoutItem,moveLayoutItem} from '../src/domain/layout.js';
import {layoutStage} from '../src/features/layout/layout.js';
import {layoutDefaults,resizeLayoutGeometry} from '../src/features/layout/geometry.js';
test('line and arrow placements retain bounded geometry, direction and color without inventory records',()=>{
 const state=emptyWorkspace();
 for(const kind of ['line','arrow']){
  const item=addLayoutObject(state,{kind,color:'blue'});assert.equal(item.width,160);assert.equal(item.height,48);
  resizeLayoutItem(state,item.id,240,60);moveLayoutItem(state,item.id,50,50,45);assert.equal(validateWorkspace(state),true);
  assert.equal(layoutDefaults(item).max,600);assert.ok(resizeLayoutGeometry(item,'e',20,0,1000,700).width>240);
  const bad=structuredClone(state);bad.layoutObjects.at(-1).width=601;assert.equal(validateWorkspace(bad),false);
 }
 assert.equal(state.gear.length,0);const html=layoutStage(state);assert.match(html,/layout-line-art/);assert.match(html,/vector-effect="non-scaling-stroke"/);assert.match(html,/rotate\(45deg\)/);
});
test('text defaults to transparent and only filled backgrounds opt into rounded surfaces',()=>{
 const state=emptyWorkspace();addLayoutObject(state,{kind:'text',name:'<Transparent>'});addLayoutObject(state,{kind:'text',name:'Filled',background:'#112233'});
 const html=layoutStage(state);assert.match(html,/background:transparent/);assert.match(html,/layout-text has-background/);assert.match(html,/background:#112233/);assert.match(html,/&lt;Transparent&gt;/);
});
