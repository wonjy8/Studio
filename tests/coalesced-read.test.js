import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCoalescer} from '../server/coalesced-read.js';

test('only active same-identity reads are shared; completed values/errors are never cached',async()=>{
 const reads=createReadCoalescer({limit:2});let calls=0,release;
 const loader=()=>{calls++;return new Promise(resolve=>release=resolve);};
 const first=reads.run('a:generation1',loader),second=reads.run('a:generation1',loader);await new Promise(r=>setImmediate(r));assert.equal(calls,1);release('value');assert.deepEqual(await Promise.all([first,second]),['value','value']);
 assert.equal(await reads.run('a:generation1',()=>{calls++;return 'fresh';}),'fresh');assert.equal(calls,2);
 let fail;const bad=reads.run('a:generation1',()=>new Promise((_r,reject)=>fail=reject)),joined=reads.run('a:generation1',()=>{throw Error('Should join');});await new Promise(r=>setImmediate(r));const results=Promise.allSettled([bad,joined]);fail(Error('Fictional outage'));assert.deepEqual((await results).map(r=>r.status),['rejected','rejected']);assert.equal(await reads.run('a:generation1',()=>42),42);
 const distinct=await Promise.all([reads.run('a:generation1',()=>1),reads.run('a:generation2',()=>2),reads.run('b:generation1',()=>3)]);assert.deepEqual(distinct,[1,2,3]);
});
