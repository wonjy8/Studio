import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {token,digest} from '../server/auth.js';
test('administrator diagnostics identify registration failures without capturing credentials or request content',async t=>{
 const dir=await mkdtemp('/tmp/studio-diagnostics-'),origin='http://localhost';const {server,db}=await createApp({dir,origin,secure:false});
 const cookies={};for(const uid of ['owner','member']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'fictional');const raw=token();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),uid,Date.now()+3600000);cookies[uid]='studio_session='+raw;}
 db.prepare("INSERT INTO site_settings VALUES('admin_user_id','owner')").run();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,method='GET',data,cookie='')=>fetch(base+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const path='/api/connections/diagnostics';assert.equal((await call(path)).status,401);assert.equal((await call(path,'GET',undefined,cookies.member)).status,403);
 const marker='DO_NOT_RECORD_FICTIONAL_SECRET';
 assert.equal((await call('/oauth/register','POST',{redirect_uris:[`https://${marker}@unsupported.example/callback?private=${marker}`],token_endpoint_auth_method:'none',client_secret:marker})).status,400);
 const registered=await (await call('/oauth/register','POST',{redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect'],token_endpoint_auth_method:'client_secret_post'})).json();assert.ok(registered.client_secret);
 await call('/mcp','POST',{jsonrpc:'2.0',id:1,method:'initialize',params:{private:marker}});
 await call('/mcp','POST',{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'fetch',arguments:{id:marker}}});
 const report=await (await call(path,'GET',undefined,cookies.owner)).json();assert.equal(report.version,'connection-diagnostics-1');assert.equal(report.toolSchemaVersion,7);
 const rejected=report.events.find(e=>e.reason==='invalid_redirect_uri');assert.equal(rejected.stage,'client_registration');assert.equal(rejected.status,400);assert.deepEqual(rejected.details.callbackHosts,['unsupported.example']);
 assert.ok(report.events.some(e=>e.stage==='client_registration'&&e.status===201));assert.ok(report.events.some(e=>e.stage==='mcp_initialize'));assert.ok(report.events.some(e=>e.stage==='tool_call'&&e.reason==='tool_auth_required'&&e.details.tool==='fetch'));
 const serialized=JSON.stringify(report);for(const value of [marker,registered.client_secret,registered.client_id,cookies.owner])assert.equal(serialized.includes(value),false);
 for(let i=0;i<105;i++)await call('/.well-known/oauth-authorization-server');assert.equal(db.prepare('SELECT count(*) AS n FROM connection_diagnostics').get().n,100);
});
