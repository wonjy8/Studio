import test from 'node:test';
import assert from 'node:assert/strict';
import {createBibleLibrary} from '../src/features/bible-library.js';
const fixture=(text='Fictional first',importedAt=1,revision=String(importedAt))=>({bible:{id:'ko',title:'표준새번역',importedAt,revision},versions:[{id:'ko',title:'표준새번역',importedAt,revision}],books:[{book:'창세기',chapters:2}],verses:[{book:'창세기',chapter:1,verse:1,text},{book:'창세기',chapter:2,verse:1,text:'Fictional next'}]});
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
test('whole translation download serves unseen chapters and searches locally without caching annotations',async()=>{
 const calls=[],data=fixture(),library=createBibleLibrary('library-test-owner',{fetcher:async path=>{calls.push(path);const query=new URL(path,'https://fixture.test').searchParams;return {...data,verses:query.has('download')?data.verses:data.verses.filter(v=>v.chapter===Number(query.get('chapter')))};}});
 await library.read(new URLSearchParams({book:'창세기',chapter:'1'}));await settle();assert.equal(calls.filter(c=>c.includes('download=1')).length,1);
 const before=calls.length,result=await library.read(new URLSearchParams({book:'창세기',chapter:'2'}));assert.equal(result.verses[0].text,'Fictional next');assert.equal(calls.length,before);
 assert.equal((await library.read(new URLSearchParams({q:'next'}))).verses.length,1);assert.equal(calls.length,before);assert.ok(calls.every(path=>!path.includes('annotations')));
});
test('account partitioning and background revision checks prevent reusing another account or obsolete download',async()=>{
 let data=fixture('Original'),calls=[];const fetcher=async path=>{calls.push(path);return structuredClone(data);};
 const a=createBibleLibrary('library-test-revision',{fetcher});await a.read(new URLSearchParams({book:'창세기',chapter:'1'}));await settle();
 data=fixture('Updated',1,'updated-content-hash');const reopened=createBibleLibrary('library-test-revision',{fetcher});assert.equal((await reopened.read(new URLSearchParams({book:'창세기',chapter:'1'}))).verses[0].text,'Original');await settle();assert.equal((await reopened.read(new URLSearchParams({book:'창세기',chapter:'1'}))).verses[0].text,'Updated');
 let otherCalls=0;const other=createBibleLibrary('library-test-other',{fetcher:async()=>{otherCalls++;return fixture('Other account');}});assert.equal((await other.read(new URLSearchParams({book:'창세기',chapter:'1'}))).verses[0].text,'Other account');assert.ok(otherCalls>0);
});
test('failed requests are retryable instead of becoming a cached failure',async()=>{
 let attempts=0;const library=createBibleLibrary('library-test-retry',{fetcher:async()=>{if(++attempts===1)throw Error('Fictional offline');return fixture();}});
 await assert.rejects(library.read(new URLSearchParams({book:'창세기',chapter:'1'})),/Fictional offline/);assert.equal((await library.read(new URLSearchParams({book:'창세기',chapter:'1'}))).verses.length,2);
});
