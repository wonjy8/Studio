import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,validateWorkspace} from '../src/domain/workspace.js';
import {addLayoutObject,updateLayoutText,resizeLayoutItem} from '../src/domain/layout.js';
import {layoutStage,placementForm,positionForm} from '../src/features/layout/layout.js';
import {layoutItemGeometry,resizeLayoutGeometry,rotateLayoutGeometry,layoutRotationPosition} from '../src/features/layout/geometry.js';
const edges=['n','ne','e','se','s','sw','w','nw'],near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function rotate(x,y,angle){const a=angle*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};}
function anchor(item,edge){const g=layoutItemGeometry(item,900,700),sx=edge.includes('e')?1:edge.includes('w')?-1:0,sy=edge.includes('s')?1:edge.includes('n')?-1:0,offset=rotate(-sx*g.width/2,-sy*g.height/2,item.rotation);return {x:g.left+offset.x,y:g.top+offset.y};}
test('rotated resize follows local axes and retains opposite world anchor for all handles',()=>{
 for(const kind of ['table','person','text'])for(const rotation of [0,30,45,90,137])for(const edge of edges){
  const start={kind,shape:kind==='table'?'rectangle':undefined,width:kind==='person'?80:180,height:kind==='person'?80:110,x:35.123456,y:46.765432,rotation},before=structuredClone(start),sx=edge.includes('e')?1:edge.includes('w')?-1:0,sy=edge.includes('s')?1:edge.includes('n')?-1:0,delta=rotate(sx*20,sy*20,rotation),old=anchor(start,edge),next=resizeLayoutGeometry(start,edge,delta.x,delta.y,900,700,{snap:false}),moved={...start,...next},after=anchor(moved,edge);
  near(after.x,old.x);near(after.y,old.y);near(next.width,start.width+(sx||kind==='person'?20:0));near(next.height,start.height+(sy||kind==='person'?20:0));assert.deepEqual(start,before);
 }
});
test('rotation helper normalizes angles, supports Shift45 snap and retains visual center',()=>{
 const start={kind:'table',width:120,height:80,x:35.123456,y:46.765432,rotation:0},g=layoutItemGeometry(start,900,700),angle=rotateLayoutGeometry(start,{x:g.left+100,y:g.top},{x:g.left,y:g.top+100},900,700);near(angle,90);
 const pointer=rotate(100,0,38);assert.equal(rotateLayoutGeometry(start,{x:g.left+100,y:g.top},{x:g.left+pointer.x,y:g.top+pointer.y},900,700,{shiftKey:true}),45);
 const next=layoutRotationPosition(start,137,900,700),moved=layoutItemGeometry({...start,...next},900,700);near(moved.left,g.left);near(moved.top,g.top);assert.equal(layoutRotationPosition(start,-45,900,700).rotation,315);
});
test('default resize snapping has screen-pixel entry and release hysteresis without data mutation',()=>{
 const start={kind:'table',shape:'rectangle',width:150,height:100,x:50,y:50,rotation:0},before=structuredClone(start);
 const entered=resizeLayoutGeometry(start,'w',23,0,900,700);assert.equal(entered.width,120);assert.equal(entered.snapped,true);
 const retained=resizeLayoutGeometry(start,'w',20,0,900,700,{snapState:entered.snapState});assert.equal(retained.width,120);
 const released=resizeLayoutGeometry(start,'w',17,0,900,700,{snapState:retained.snapState});assert.equal(released.width,133);assert.equal(released.snapped,false);
 const scaled=resizeLayoutGeometry(start,'w',15,0,900,700,{screenScale:.5});assert.equal(scaled.width,120);assert.equal(resizeLayoutGeometry(start,'w',23,0,900,700,{snap:false}).width,127);assert.deepEqual(start,before);
 for(const item of [{kind:'person',width:100,height:100,target:80},{kind:'table',shape:'circle',width:140,height:140,target:120},{kind:'text',width:180,height:70,target:160}]){const next=resizeLayoutGeometry({...item,x:50,y:50},'w',15,0,900,700);assert.equal(next.width,item.target);}
});
test('text creation, atomic edit, size bounds and escaped rendering preserve literal content',()=>{
 const state=emptyWorkspace(),text=addLayoutObject(state,{kind:'text',name:'<img src=x onerror=alert(1)>\nFictional text'});assert.equal(text.width,160);assert.equal(text.height,60);assert.equal(text.background,'transparent');assert.equal(validateWorkspace(state),true);
 updateLayoutText(state,text.id,{name:'Fictional changed\nline',background:'#12AbEF'});assert.equal(text.background,'#12AbEF');const before=structuredClone(text);
 for(const fields of [{name:''},{name:'a'.repeat(2001)},{background:'red'},{background:'url(https://example.invalid)'},{background:'#123'},{gearId:'foreign'}]){assert.throws(()=>updateLayoutText(state,text.id,fields));assert.deepEqual(text,before);}
 assert.throws(()=>addLayoutObject(state,{kind:'text',name:'Fictional',memberId:'foreign'}));assert.throws(()=>addLayoutObject(state,{kind:'text',name:'Fictional',background:'red'}));resizeLayoutItem(state,text.id,800,1);assert.equal(text.width,600);assert.equal(text.height,48);
 updateLayoutText(state,text.id,{name:'<script>fictional</script>',background:'transparent'});const html=layoutStage(state);assert.match(html,/&lt;script&gt;fictional&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/class="layout-text-content"/);assert.match(html,/data-rotate="ne"/);assert.match(html,/transform:translate\(-50%,-50%\) rotate\(0deg\)/);assert.match(placementForm(state,'text'),/textarea name="name" maxlength="2000"/);assert.match(positionForm(text),/name="background"/);
});
