import test from 'node:test';
import assert from 'node:assert/strict';
let instance=0;
const freshApi=()=>import(`../src/integrations/api.js?reload-test=${++instance}`);
test('ignored workspace reload does not advance the revision used for a later save',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const api=await freshApi(),sent=[];
 let next={revision:1,state:{name:'saved'}};
 globalThis.fetch=async(_url,options={})=>{if(options.method==='PUT'){sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({revision:2,state:{name:'intent'}})};}return {ok:true,json:async()=>next};};
 assert.deepEqual(await api.loadWorkspace(),{name:'saved'});
 next={revision:9,state:{name:'unrelated newer state'}};
 assert.equal(await api.loadWorkspace({accept:()=>false}),null);
 await api.saveWorkspace({name:'intent'});
 assert.equal(sent[0].revision,1);assert.deepEqual(sent[0].state,{name:'intent'});
});
test('reload acceptance is checked after the delayed response, and accepted reads still adopt revisions',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const api=await freshApi();let release,accept=true,sent;
 globalThis.fetch=async()=>({ok:true,json:()=>new Promise(resolve=>release=resolve)});
 const pending=api.loadWorkspace({accept:()=>accept});await new Promise(resolve=>setImmediate(resolve));
 accept=false;release({revision:12,state:{name:'late'}});assert.equal(await pending,null);
 globalThis.fetch=async(_url,options={})=>{if(options.method==='PUT'){sent=JSON.parse(options.body);return {ok:false,status:409,json:async()=>({error:'conflict'})};}return {ok:true,json:async()=>({revision:3,state:{name:'accepted'}})};};
 assert.deepEqual(await api.loadWorkspace(),{name:'accepted'});
 await assert.rejects(api.saveWorkspace({name:'intent'}),error=>error.status===409);
 assert.equal(sent.revision,3);
});
