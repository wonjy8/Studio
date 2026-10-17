import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resizeLayoutTable,moveLayoutItem} from '../src/domain/layout.js';
import {layoutItemGeometry,resizeLayoutGeometry} from '../src/features/layout/layout.js';
const edges=['n','ne','e','se','s','sw','w','nw'];
const bounds=(item,w=900,h=600)=>{const g=layoutItemGeometry(item,w,h);return {...g,l:g.left-g.width/2,r:g.left+g.width/2,t:g.top-g.height/2,b:g.top+g.height/2};};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('rectangle handles follow pointer once and retain opposite boundaries at fractional coordinates',()=>{
 for(const edge of edges){
  const start={kind:'table',shape:'rectangle',width:240,height:180,x:35.12345,y:41.23456};const before=structuredClone(start),old=bounds(start);
  const dx=edge.includes('w')?20:edge.includes('e')?20:0,dy=edge.includes('n')?-20:edge.includes('s')?20:0;
  const next=resizeLayoutGeometry(start,edge,dx,dy,900,600),now=bounds({...start,...next});
  close(now.l,old.l+(edge.includes('w')?dx:0));close(now.r,old.r+(edge.includes('e')?dx:0));
  close(now.t,old.t+(edge.includes('n')?dy:0));close(now.b,old.b+(edge.includes('s')?dy:0));assert.deepEqual(start,before);
 }
});
test('circle handles retain opposite edge/corner and cardinal perpendicular center',()=>{
 for(const edge of edges){
  const start={kind:'table',shape:'circle',width:220,height:220,x:35.12345,y:41.23456},old=bounds(start);
  const dx=edge.includes('w')?-20:edge.includes('e')?20:0,dy=edge.includes('n')?-20:edge.includes('s')?20:0;
  const next=resizeLayoutGeometry(start,edge,dx,dy,900,600),now=bounds({...start,...next});close(now.width,240);close(now.height,240);
  if(edge.includes('w')){close(now.r,old.r);close(now.l,old.l-20);}else if(edge.includes('e')){close(now.l,old.l);close(now.r,old.r+20);}else close(now.left,old.left);
  if(edge.includes('n')){close(now.b,old.b);close(now.t,old.t-20);}else if(edge.includes('s')){close(now.t,old.t);close(now.b,old.b+20);}else close(now.top,old.top);
 }
});
test('anchored resize respects viewport/min/max limits and remains stable after mobile fit',()=>{
 for(const [w,h] of [[900,600],[260,380]])for(const shape of ['rectangle','circle'])for(const edge of edges){
  const start={kind:'table',shape,width:360,height:shape==='circle'?360:240,x:35.123,y:55.567};
  for(const delta of [-10000,-20,20,10000]){const next=resizeLayoutGeometry(start,edge,delta,delta,w,h),now=bounds({...start,...next},w,h);assert.ok(next.width>=48&&next.width<=360);assert.ok(next.height>=48&&next.height<=360);assert.ok(now.l>=9.999&&now.r<=w-9.999);assert.ok(now.t>=9.999&&now.b<=h-9.999);close(now.width,next.width);close(now.height,next.height);}
  assert.deepEqual(resizeLayoutGeometry(start,edge,0,0,w,h),{width:start.width,height:start.height,x:start.x,y:start.y});
 }
});
test('screen pixel conversion at CSS scale produces one-for-one screen edge travel',()=>{
 const start={kind:'table',shape:'rectangle',width:240,height:180,x:35.123,y:41.234};const old=bounds(start),scale=.75;
 const next=resizeLayoutGeometry(start,'w',20/scale,0,900,600),now=bounds({...start,...next});close((now.l-old.l)*scale,20);close(now.r,old.r);
});
test('thin mobile-fit rectangles retain domain-valid axes and fixed unaffected boundaries on resize',()=>{
 for(const [width,height,w,h] of [[360,48,260,380],[48,360,260,260]]){
  const start={id:'thin-table',kind:'table',shape:'rectangle',width,height,x:35.123456,y:55.765432},snapshot=structuredClone(start),old=bounds(start,w,h);
  close(old.width,width===48?48:240);close(old.height,height===48?48:240);
  for(const edge of edges)for(const delta of [-20,20]){
   const next=resizeLayoutGeometry(start,edge,delta,delta,w,h),now=bounds({...start,...next},w,h);
   const project={layoutObjects:[structuredClone(start)],cameras:[]};resizeLayoutTable(project,start.id,next.width,next.height);moveLayoutItem(project,start.id,next.x,next.y);const persisted=bounds(project.layoutObjects[0],w,h);close(persisted.l,now.l);close(persisted.r,now.r);close(persisted.t,now.t);close(persisted.b,now.b);
   assert.ok(next.width>=48&&next.height>=48);close(now.width,next.width);close(now.height,next.height);
   if(edge.includes('w'))close(now.r,old.r);else if(edge.includes('e'))close(now.l,old.l);else {close(now.l,old.l);close(now.r,old.r);}
   if(edge.includes('n'))close(now.b,old.b);else if(edge.includes('s'))close(now.t,old.t);else {close(now.t,old.t);close(now.b,old.b);}
  }
  assert.deepEqual(start,snapshot);
 }
});
test('degenerate canvas cannot mutate stored geometry through resize',()=>{
 const start={kind:'table',shape:'rectangle',width:360,height:48,x:35.123456,y:55.765432};
 for(const [w,h] of [[67,380],[260,67],[0,0]])for(const edge of edges)assert.deepEqual(resizeLayoutGeometry(start,edge,20,-20,w,h),{width:360,height:48,x:start.x,y:start.y});
});
