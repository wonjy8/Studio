// Synthetic fixtures only. Separate processes make maxRSS observations comparable.
import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {computeEngine} from '../src/compute/runtime.js';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fixtureZip} from './qa-scripture-fixtures.mjs';
import {bibleBooks} from '../src/domain/bible.js';
import {readNotionZip,notionBibleVerses} from '../server/notion-scripture-import.js';
import {scriptureImportRunner} from '../server/scripture-import-runner.js';
import {createJsMaterialSearchIndex,createMaterialSearchIndex,matchesMaterialQuery,materialQueryText} from '../src/domain/material-index.js';
import {eventLanes,jsHeapEventLanes} from '../src/domain/calendar.js';
function legacyLanes(events){const sorted=events.filter(e=>e.start!==null).map(e=>({...e})).sort((a,b)=>a.start-b.start||a.end-b.end);let group=[],active=[],max=0;const finish=()=>{for(const e of group)e.columns=max;group=[];max=0;};for(const event of sorted){active=active.filter(e=>Math.max(e.end,e.start+30)>event.start);if(!active.length&&group.length)finish();const used=new Set(active.map(e=>e.lane));let lane=0;while(used.has(lane))lane++;event.lane=lane;active.push(event);group.push(event);max=Math.max(max,lane+1);}finish();return sorted;}
function median(fn){fn();const times=[];for(let i=0;i<7;i++){const start=performance.now();fn();times.push(performance.now()-start);}return +times.sort((a,b)=>a-b)[3].toFixed(3);}
if(process.argv[2]?.startsWith('import-')){
 const csv='구절,구약·신약,본문,성경,장,절\n'+Array.from({length:30000},(_,i)=>{const book=bibleBooks[Math.floor(i/600)],chapter=Math.floor(i%600/20)+1,verse=i%20+1;return `${book} ${chapter}:${verse},구약,${'합성 본문 '.repeat(20)},${book},${chapter},${verse}`;}).join('\n');
 const zip=fixtureZip({'성경.csv':csv}),run=scriptureImportRunner();let largestGap=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();largestGap=Math.max(largestGap,now-last);last=now;},2);
 await new Promise(r=>setTimeout(r,10));const start=performance.now();
 let result;if(process.argv[2]==='import-rust-worker')result=(await run(async()=>Buffer.from(zip))).bible;else if(process.argv[2]==='import-js-worker'){const worker=new Worker(new URL('./bench-compute-legacy-worker.mjs',import.meta.url));result=await new Promise((resolve,reject)=>{worker.once('error',reject);worker.once('message',resolve);const bytes=Uint8Array.from(zip);worker.postMessage(bytes.buffer,[bytes.buffer]);});await worker.terminate();}else result=notionBibleVerses(readNotionZip(zip));
 const milliseconds=performance.now()-start;await new Promise(r=>setTimeout(r,10));clearInterval(timer);run.close();assert.equal(result.verses.length,30000);
 console.log(JSON.stringify({case:process.argv[2],milliseconds:+milliseconds.toFixed(2),mainThreadGapMs:+largestGap.toFixed(2),maxRSSKiB:process.resourceUsage().maxRSS,zipBytes:zip.length,uncompressedBytes:Buffer.byteLength(csv),outputRows:result.verses.length}));
}else{
 const output={synthetic:true,notNAS:true,node:process.version,imports:[]};
 for(const name of ['import-inline','import-js-worker','import-rust-worker']){const run=spawnSync(process.execPath,[import.meta.filename,name],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);output.imports.push(JSON.parse(run.stdout));}
 const items=Array.from({length:2000},(_,i)=>({id:String(i),title:'Fixture '+i,searchText:'가상 문서 '.repeat(200)})),index=createMaterialSearchIndex(items),jsIndex=createJsMaterialSearchIndex(items),queries=['가상 문서','문서 fixture','missing'];
 for(const q of queries)assert.deepEqual(index(q),jsIndex(q));
 output.search={items:items.length,legacyMedianMs:median(()=>queries.forEach(q=>items.filter(item=>matchesMaterialQuery(item,q)))),jsIndexMedianMs:median(()=>queries.forEach(q=>jsIndex(q))),rustIndexMedianMs:median(()=>queries.forEach(q=>index(q))),rustBuildMedianMs:median(()=>{const index=createMaterialSearchIndex(items);index.dispose();}),rustMemoryBytes:computeEngine.memoryBytes,rustBinaryBytes:readFileSync(new URL('../src/media/'+(await import('../src/media/compute-binary.js')).computeBinary,import.meta.url)).length,indexCopyBytes:items.reduce((sum,item)=>sum+4+materialQueryText(item).length*2,0)};index.dispose();
 const events=Array.from({length:2000},(_,i)=>({id:String(i),start:600,end:660}));assert.deepEqual(eventLanes(events),legacyLanes(events));
 output.lanes={events:events.length,legacyMedianMs:median(()=>legacyLanes(events)),jsHeapColdMedianMs:median(()=>{const shift=Math.random();return jsHeapEventLanes(events.map(e=>({...e,start:e.start+shift,end:e.end+shift})));}),rustCachedMedianMs:median(()=>eventLanes(events)),rustColdMedianMs:median(()=>{const shift=Math.random();return eventLanes(events.map(e=>({...e,start:e.start+shift,end:e.end+shift})));})};
 console.log(JSON.stringify(output,null,2));
}
