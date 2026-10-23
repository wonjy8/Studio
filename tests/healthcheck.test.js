import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {checkHealth} from '../tools/healthcheck.js';
async function serve(t,handler){const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});return server.address().port;}
test('health probe accepts only bounded successful JSON health, with no redirect following',async t=>{let mode='ok';const port=await serve(t,(_req,res)=>{if(mode==='redirect'){res.writeHead(302,{Location:'http://example.invalid/'});res.end();}else if(mode==='large')res.end('x'.repeat(2048));else if(mode==='bad')res.end('not json');else if(mode==='false')res.end('{"ok":false}');else res.end('{"ok":true,"revision":"fixture"}');});assert.equal(await checkHealth({port}),true);for(mode of ['redirect','large','bad','false'])assert.equal(await checkHealth({port}),false);});
test('health probe times out a stalled local endpoint and releases its socket',async t=>{const port=await serve(t,()=>{});assert.equal(await checkHealth({port,timeoutMs:20}),false);});
