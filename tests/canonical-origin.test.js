import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/canonical-origin.js',import.meta.url),'utf8');
function load(url,readyState='loading'){
 const current=new URL(url),redirects=[],apps=[],events=[];
 current.replace=value=>redirects.push(value);
 const document={readyState,createElement:()=>({}),body:{append:app=>apps.push(app)},addEventListener:(type,callback,options)=>events.push({type,callback,options})};
 runInNewContext(source,{window:{location:current},document});return {redirects,apps,events};
}
test('canonical HTTP redirects preserve path/query/hash before any application bootstrap',()=>{
 for(const url of ['http://studio.wonjongyou.com/','http://studio.wonjongyou.com:80/production/shoots?project=fictional%20project&next=%2F%2Fevil.example#fictional-fragment']){
  const result=load(url);assert.deepEqual(result.redirects,['https://studio.wonjongyou.com'+new URL(url).pathname+new URL(url).search+new URL(url).hash]);assert.equal(result.apps.length,0);assert.equal(result.events.length,0);
 }
});
test('HTTPS, localhost, other hosts and unusual ports retain origin and bootstrap only after DOM readiness',()=>{
 for(const url of ['https://studio.wonjongyou.com/production','http://localhost:8123/production','http://127.0.0.1:8123/','http://studio.wonjongyou.com:8080/','http://studio.wonjongyou.com.evil.example/','http://studio.wonjongyou.com./']){
  const result=load(url);assert.equal(result.redirects.length,0);assert.equal(result.apps.length,0);assert.equal(result.events[0].type,'DOMContentLoaded');assert.equal(result.events[0].options.once,true);result.events[0].callback();assert.equal(result.apps[0].type,'module');assert.equal(result.apps[0].src,'/src/app.js');
 }
 const loaded=load('http://localhost:8123/','complete');assert.equal(loaded.events.length,0);assert.equal(loaded.apps.length,1);
});
