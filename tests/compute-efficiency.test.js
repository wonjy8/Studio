import test from 'node:test';
import assert from 'node:assert/strict';
import {eventLanes} from '../src/domain/calendar.js';
import {createMaterialSearchIndex,matchesMaterialQuery} from '../src/domain/material-index.js';
import {scriptureImportRunner} from '../server/scripture-import-runner.js';
import {readNotionZip,notionScriptureNotes} from '../server/notion-scripture-import.js';
import {fixtureZip} from '../tools/qa-scripture-fixtures.mjs';
function legacyLanes(events){const sorted=events.filter(e=>e.start!==null).map(e=>({...e})).sort((a,b)=>a.start-b.start||a.end-b.end);let group=[],active=[],max=0;const finish=()=>{for(const e of group)e.columns=max;group=[];max=0;};for(const event of sorted){active=active.filter(e=>Math.max(e.end,e.start+30)>event.start);if(!active.length&&group.length)finish();const used=new Set(active.map(e=>e.lane));let lane=0;while(used.has(lane))lane++;event.lane=lane;active.push(event);group.push(event);max=Math.max(max,lane+1);}finish();return sorted;}
export {legacyLanes};
test('heap layout preserves exact old ordering, short durations, ties and numeric-only cached geometry',()=>{
 let seed=37;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};
 for(let n=0;n<120;n++){const events=Array.from({length:n*3},(_,i)=>{const start=random()%1440;return {id:'a-'+i,start:i%17?start:null,end:Math.min(1440,start+(random()%240)),name:'Private A'};});const before=structuredClone(events);assert.deepEqual(eventLanes(events),legacyLanes(events));assert.deepEqual(events,before);const other=events.map(e=>({...e,id:'b-'+e.id,name:'Private B',date:'2026-11-01'}));assert.deepEqual(eventLanes(other),legacyLanes(other));assert.ok(eventLanes(other).every(e=>e.name==='Private B'));}
 const overlap=Array.from({length:2000},(_,i)=>({id:String(i),start:600,end:630}));assert.deepEqual(eventLanes(overlap),legacyLanes(overlap));
});
test('snapshot-local material index matches legacy query semantics and cannot reuse another account snapshot',()=>{
 const a=[{id:'a',title:'é TITLE',description:'가상',tags:['한글'],metadata:{width:600,height:300}},{id:'a2',title:'other',searchText:'private content'}],b=[{id:'b',title:'Different'}];
 const index=createMaterialSearchIndex(a);for(const q of ['', 'e\u0301','TITLE 한글','가상 2:1','private content','missing','a'.repeat(1001),Array(34).fill('a').join(' ')])assert.deepEqual(index(q),a.filter(x=>matchesMaterialQuery(x,q)));
 assert.equal(createMaterialSearchIndex(b)('private').length,0);
 const updated=a.map(x=>({...x,title:'New version',searchText:''}));assert.equal(createMaterialSearchIndex(updated)('private').length,0);
});
test('ZIP worker keeps parsing semantics, rejects unsafe input, reserves before body reads, cancels and recovers',async()=>{
 const run=scriptureImportRunner(),zip=fixtureZip({'Fixture 12345678123412341234123456789012.md':'# Fixture\n\n- item\n- [x] done\n> quote'});
 const expected=notionScriptureNotes(readNotionZip(zip));
 const result=await run(async()=>Buffer.from(zip));
 assert.deepEqual(result.notes.map(n=>({...n,document:{...n.document,id:'ignored',blocks:n.document.blocks.map(b=>({...b,id:'ignored'}))}})),expected.map(n=>({...n,document:{...n.document,id:'ignored',blocks:n.document.blocks.map(b=>({...b,id:'ignored'}))}})));
 const preview=await run(async()=>Buffer.from(zip),{preview:true});assert.equal(preview.summary.notes,1);assert.equal(preview.notes,undefined);
 await assert.rejects(run(async()=>fixtureZip({'../escape.md':'unsafe'})),e=>e.status===400);
 let release,reads=0;const first=run(()=>new Promise(r=>release=r));await assert.rejects(run(async()=>{reads++;return zip;}),e=>e.status===429);assert.equal(reads,0);release(Buffer.from(zip));await first;
 const controller=new AbortController();controller.abort();await assert.rejects(run(async()=>{reads++;return zip;},{signal:controller.signal}),e=>e.status===499);assert.equal(reads,0);
 // Abort while a real worker is starting; no stale result survives into retry.
 const active=new AbortController();const pending=run(async()=>Buffer.from(zip),{signal:active.signal});queueMicrotask(()=>active.abort());await assert.rejects(pending,e=>e.status===499);assert.equal((await run(async()=>Buffer.from(zip),{preview:true})).summary.notes,1);
 run.close();await assert.rejects(run(async()=>zip),e=>e.status===503);
});

test('Rust CSV/ZIP core matches JS golden semantics including Unicode, escaping and safety limits',async()=>{
 const {createComputeEngine}=await import('../src/compute/engine.js');const engine=await createComputeEngine();const {parseNotionCsv}=await import('../server/notion-scripture-import.js');
 const cells=['','한글 😀','a,b','line\nnext','"quoted"','\ufeff trim \ufeff','\u0085not JS whitespace','a\rb','𝄞'];
 for(let n=0;n<100;n++){const encode=s=>'"'+s.replaceAll('"','""')+'"';const text='z,a,__proto__\r\n'+Array.from({length:n%8+1},(_,r)=>[cells[(n+r)%cells.length],cells[(n+r+2)%cells.length],cells[(n+r+4)%cells.length]].map(encode).join(',')).join('\r\n');assert.deepEqual(engine.csv(text),parseNotionCsv(text));}
 for(const text of ['a,a\nx,y','a,b\nx','a\n"oops','a\nx"y'])assert.throws(()=>engine.csv(text));
 const files={'a.md':'\ufeff# Fixture 😀','DATA.CSV':'a,b\n"x,y",z','ignored.exe':'unused'};assert.deepEqual(engine.unzip(fixtureZip(files)),readNotionZip(fixtureZip(files)));
 assert.throws(()=>engine.unzip(fixtureZip({'../unsafe.csv':'a\nx'})));assert.throws(()=>engine.unzip(fixtureZip({'x.md':'x'.repeat(16*1024*1024+1)})));
 // An empty result does not leave prior account file contents available.
 assert.deepEqual(engine.unzip(fixtureZip({})),new Map());
});

test('Rust search overflow chunks, lone surrogates, revision rebuild and disposal remain isolated',()=>{
 const items=Array.from({length:80},(_,i)=>({id:String(i),title:i===79?'\ud800 private B':'public',searchText:'가'.repeat(65536)})),search=createMaterialSearchIndex(items);
 assert.deepEqual(search('\ud800').map(x=>x.id),['79']);assert.equal(search('private B').length,1);search.dispose();assert.throws(()=>search('public'),/만료/);
 const other=createMaterialSearchIndex([{id:'other',title:'new account'}]);assert.equal(other('private').length,0);other.dispose();
});

test('Rust ZIP rejects truncated compressed streams and forged lengths',async()=>{
 const {createComputeEngine}=await import('../src/compute/engine.js');const engine=await createComputeEngine(),zip=fixtureZip({'fixture.md':'# Fixture\n'.repeat(1000)});
 const central=zip.indexOf(Buffer.from([0x50,0x4b,1,2]));const short=Buffer.from(zip);short.writeUInt32LE(short.readUInt32LE(central+20)-2,central+20);assert.throws(()=>engine.unzip(short));
 const bomb=Buffer.from(zip);bomb.writeUInt32LE(1,central+24);assert.throws(()=>engine.unzip(bomb));
 assert.deepEqual(engine.unzip(fixtureZip({'retry.md':'# Retry'})),new Map([['retry.md','# Retry']]));
});
