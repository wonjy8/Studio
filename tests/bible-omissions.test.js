import test from 'node:test';
import assert from 'node:assert/strict';
import {withBibleOmissions} from '../src/domain/bible-omissions.js';
test('NIV display fills only known omitted references while preserving source and verse numbers',()=>{
 const rows=[{book:'마태복음',chapter:17,verse:20,text:'Fictional before'},{book:'마태복음',chapter:17,verse:22,text:'Fictional after'}],before=structuredClone(rows),version={title:'NIV'};
 const rendered=withBibleOmissions(rows,version,{book:'마태복음',chapter:17});
 assert.deepEqual(rendered.map(v=>v.verse),[20,21,22]);assert.deepEqual(rendered[1],{book:'마태복음',chapter:17,verse:21,text:'',omitted:true});assert.deepEqual(rows,before);
 assert.equal(withBibleOmissions(rows,{title:'NASB'},{book:'마태복음',chapter:17}),rows);
 assert.equal(withBibleOmissions(rows,version,{book:'창세기',chapter:1}).length,2);
 assert.equal(withBibleOmissions(rendered,version,{book:'마태복음',chapter:17}).length,3);
 const passage={book:'마태복음',chapter:17,start:21,endChapter:17,end:21};assert.deepEqual(withBibleOmissions([],version,{passage}).map(v=>v.verse),[21]);
});
