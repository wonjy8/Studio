import {commandFields} from '../src/domain/commands.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {token,digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
async function fixture(t){
 const dir=await mkdtemp('/tmp/studio-mcp-'),origin='http://localhost';const {server,db}=await createApp({dir,origin,secure:false});
 const cookies={};for(const uid of ['alpha','beta']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'fictional-hash');const raw=token();db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),uid,Date.now()+3600000);cookies[uid]='studio_session='+raw;const state=emptyWorkspace();state.project.id=uid+'-project';state.project.name='Fictional '+uid;db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(uid,1,JSON.stringify(state));}
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,method='GET',data,headers={})=>fetch(base+path,{method,redirect:'manual',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
 const callback='https://chatgpt.com/connector_platform_oauth_redirect',resource=origin+'/mcp';
 const register=async(method='none')=>{const r=await call('/oauth/register','POST',{redirect_uris:[callback],token_endpoint_auth_method:method});assert.equal(r.status,201);return r.json();};
 const form=async(data,headers={})=>fetch(base+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({resource,...data})});
 const pending=async(client,scope='studio:read studio:write')=>{
  const verifier=token(),challenge=createHash('sha256').update(verifier).digest('base64url');const params={client_id:client.client_id,redirect_uri:callback,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',resource,scope,state:'fictional-state'};
  const r=await call('/oauth/authorize?'+new URLSearchParams(params));assert.equal(r.status,302);return {id:new URL(r.headers.get('location')).searchParams.get('connect'),verifier,params};
 };
 const consent=async(p,uid='alpha',allowWrite=true,approve=true,allowFullContent=false)=>{
  const r=await call('/api/connections/authorize','POST',{requestId:p.id,approve,allowWrite,allowFullContent},{Origin:origin,Cookie:cookies[uid]});assert.equal(r.status,200);return new URL((await r.json()).redirect);
 };
 const connect=async(uid='alpha',write=true,fullContent=false)=>{
  const client=await register(),p=await pending(client);const redirect=await consent(p,uid,write,true,fullContent);assert.equal(redirect.searchParams.get('state'),'fictional-state');
  const r=await form({client_id:client.client_id,redirect_uri:callback,grant_type:'authorization_code',code:redirect.searchParams.get('code'),code_verifier:p.verifier});assert.equal(r.status,200);return {...await r.json(),client};
 };
 const rpc=async(auth,name,args={},extra={})=>{
  const r=await call('/mcp','POST',{jsonrpc:'2.0',id:1,method:name==='tools/list'||name==='initialize'?name:'tools/call',params:name==='initialize'?{protocolVersion:'2025-11-25'}:name==='tools/list'?{}:{name,arguments:args}},{Authorization:'Bearer '+auth.access_token,Accept:'application/json, text/event-stream',...extra});return {response:r,data:await r.json()};
 };
 return {db,origin,cookies,call,form,register,pending,consent,connect,rpc,resource,callback};
}
test('OAuth discovery, exact redirects, PKCE, consent denial/downgrade, code replay and rotation',async t=>{
 const f=await fixture(t),{call,origin,resource,callback}=f;
 const metadata=await (await call('/.well-known/oauth-protected-resource/mcp')).json();assert.equal(metadata.resource,resource);
 const challenge=await call('/mcp','POST',{});assert.equal(challenge.status,401);assert.match(challenge.headers.get('www-authenticate'),/resource_metadata/);
 for(const url of ['https://evil.invalid/cb','http://chatgpt.com/cb','https://chatgpt.com.evil.invalid/cb','https://user:secret@chatgpt.com/cb','https://chatgpt.com/cb#fragment'])assert.equal((await call('/oauth/register','POST',{redirect_uris:[url]})).status,400);
 const client=await f.register(),p=await f.pending(client);
 assert.equal((await call('/api/connections/requests/'+p.id)).status,401);
 assert.equal((await call('/api/connections/authorize','POST',{requestId:p.id,approve:true},{Origin:'https://evil.invalid',Cookie:f.cookies.alpha})).status,403);
 const redirect=await f.consent(p,'alpha',false);const code=redirect.searchParams.get('code');
 const base={client_id:client.client_id,redirect_uri:callback,grant_type:'authorization_code',code};
 assert.equal((await f.form({...base,code_verifier:token()})).status,400);
 assert.equal((await f.form({...base,code_verifier:p.verifier,resource:origin+'/other'})).status,400);
 const r=await f.form({...base,code_verifier:p.verifier});assert.equal(r.status,200);const auth=await r.json();assert.equal(auth.scope,'studio:read');
 assert.equal((await f.form({...base,code_verifier:p.verifier})).status,400);
 assert.equal((await call('/oauth/authorize?'+new URLSearchParams({...p.params,redirect_uri:'https://evil.invalid'}))).status,400);
 const denied=await f.consent(await f.pending(client),'alpha',true,false);assert.equal(denied.searchParams.get('error'),'access_denied');assert.equal(denied.searchParams.has('code'),false);
 const rr=await f.form({client_id:client.client_id,grant_type:'refresh_token',refresh_token:auth.refresh_token});assert.equal(rr.status,200);const next=await rr.json();assert.notEqual(next.access_token,auth.access_token);
 assert.equal((await f.form({client_id:client.client_id,grant_type:'refresh_token',refresh_token:auth.refresh_token})).status,400);
 assert.equal((await f.rpc(auth,'tools/list')).response.status,401);assert.equal((await f.rpc(next,'tools/list')).response.status,200);
 const serialized=JSON.stringify(f.db.prepare('SELECT * FROM oauth_grants').all());assert.equal(serialized.includes(next.access_token),false);assert.equal(serialized.includes(next.refresh_token),false);
});
test('MCP account isolation, read-only scopes, confirmed writes, revisions, replay and revocation',async t=>{
 const f=await fixture(t),writer=await f.connect('alpha'),reader=await f.connect('beta',false);
 assert.equal((await f.rpc(writer,'initialize')).data.result.protocolVersion,'2025-11-25');
 assert.equal((await f.call('/api/workspace','GET',undefined,{Authorization:'Bearer '+writer.access_token})).status,401);
 assert.equal((await f.call('/api/files/11111111-1111-1111-1111-111111111111','GET',undefined,{Authorization:'Bearer '+writer.access_token})).status,401);
 const readTools=(await f.rpc(reader,'tools/list')).data.result.tools;assert.equal(readTools.length,5);assert.ok(readTools.every(t=>t.annotations.readOnlyHint));
 assert.equal((await f.rpc(reader,'studio_propose_changes',{projectId:'beta-project',revision:1,commands:[]})).data.error.code,-32602);
 assert.equal((await f.rpc(writer,'tools/list',{}, {Origin:'https://evil.invalid'})).response.status,403);
 const list=(await f.rpc(writer,'studio_list_projects')).data.result.structuredContent;assert.equal(list.projects.length,1);assert.equal(list.projects[0].id,'alpha-project');
 assert.equal((await f.rpc(writer,'studio_get_project',{projectId:'beta-project'})).data.result.isError,true);
 const propose=()=>f.rpc(writer,'studio_propose_changes',{projectId:'alpha-project',revision:1,commands:[{operation:'add_shoot',values:{name:'Fictional interview',time:'10:00',location:'Set A'}}]});
 const proposal=(await propose()).data.result.structuredContent;assert.ok(proposal.proposalId);assert.equal(JSON.parse(f.db.prepare("SELECT body FROM workspaces WHERE user_id='alpha'").get().body).contents.length,0);
 assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:proposal.proposalId,confirmed:false})).data.result.isError,true);
 assert.equal((await f.rpc(reader,'studio_apply_changes',{proposalId:proposal.proposalId,confirmed:true})).data.error.code,-32602);
 const applied=(await f.rpc(writer,'studio_apply_changes',{proposalId:proposal.proposalId,confirmed:true})).data.result.structuredContent;assert.equal(applied.revision,2);
 assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:proposal.proposalId,confirmed:true})).data.result.isError,true);
 const state=JSON.parse(f.db.prepare("SELECT body FROM workspaces WHERE user_id='alpha'").get().body);assert.equal(state.contents[0].name,'Fictional interview');assert.equal(state.schedule[0][2],state.contents[0].id);
 assert.equal(JSON.parse(f.db.prepare("SELECT body FROM workspaces WHERE user_id='beta'").get().body).contents.length,0);
 const conflict=(await f.rpc(writer,'studio_propose_changes',{projectId:'alpha-project',revision:2,commands:[{operation:'update_shoot',entityId:state.contents[0].id,values:{time:'11:00'}}]})).data.result.structuredContent;
 f.db.prepare("UPDATE workspaces SET revision=3 WHERE user_id='alpha'").run();assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:conflict.proposalId,confirmed:true})).data.result.structuredContent.error,'REVISION_CONFLICT');
 const invalid=(await f.rpc(writer,'studio_propose_changes',{projectId:'alpha-project',revision:3,commands:[{operation:'update_project',values:{__secret:'bad'}}]})).data.result;assert.equal(invalid.isError,true);
 const connections=await (await f.call('/api/connections','GET',undefined,{Cookie:f.cookies.alpha})).json();assert.equal(connections.connections.length,1);
 await f.call('/api/connections/'+connections.connections[0].id,'DELETE',undefined,{Origin:f.origin,Cookie:f.cookies.beta});assert.equal((await f.rpc(writer,'tools/list')).response.status,200);
 await f.call('/api/connections/'+connections.connections[0].id,'DELETE',undefined,{Origin:f.origin,Cookie:f.cookies.alpha});assert.equal((await f.rpc(writer,'tools/list')).response.status,401);
});
test('app registration can discover static tools without access to any production data',async t=>{
 const f=await fixture(t);
 const rpc=async(method,params={})=>f.call('/mcp','POST',{jsonrpc:'2.0',id:1,method,params});
 const initialized=await rpc('initialize',{protocolVersion:'2025-11-25'});assert.equal(initialized.status,200);
 const listed=await (await rpc('tools/list')).json();assert.equal(listed.result.tools.length,9);assert.ok(listed.result.tools.every(t=>t.securitySchemes[0].type==='oauth2'));
 assert.equal(JSON.stringify(listed).includes('Fictional alpha'),false);assert.equal(JSON.stringify(listed).includes('alpha-project'),false);
 for(const name of ['studio_list_projects','studio_get_project','studio_apply_changes']){
  const r=await rpc('tools/call',{name,arguments:{projectId:'alpha-project',confirmed:true}});const data=await r.json();assert.equal(data.result.isError,true);assert.match(data.result._meta['mcp/www_authenticate'][0],/resource_metadata/);
  if(name==='studio_apply_changes')assert.match(data.result._meta['mcp/www_authenticate'][0],/studio:write/);
  assert.equal(JSON.stringify(data).includes('Fictional alpha'),false);
 }
 assert.equal((await f.call('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/list'},{Authorization:'Bearer '+token()})).status,401);
});
test('DCR accepts confidential post/basic clients while enforcing secret and PKCE authentication',async t=>{
 const f=await fixture(t);
 const metadata=await (await f.call('/.well-known/oauth-authorization-server')).json();assert.deepEqual(metadata.token_endpoint_auth_methods_supported,['none','client_secret_post','client_secret_basic']);
 for(const method of ['client_secret_post','client_secret_basic']){
  const client=await f.register(method);assert.ok(client.client_secret);assert.equal(client.token_endpoint_auth_method,method);
  assert.equal(f.db.prepare('SELECT secret_hash FROM oauth_clients WHERE id=?').get(client.client_id).secret_hash,digest(client.client_secret));
  const pending=await f.pending(client),redirect=await f.consent(pending);
  const body={client_id:client.client_id,redirect_uri:f.callback,grant_type:'authorization_code',code:redirect.searchParams.get('code'),code_verifier:pending.verifier};
  assert.equal((await f.form(body)).status,401);
  const credentials=secret=>method==='client_secret_post'?{data:{...body,client_secret:secret},headers:{}}:{data:body,headers:{Authorization:'Basic '+Buffer.from(client.client_id+':'+secret).toString('base64')}};
  let params=credentials('wrong');assert.equal((await f.form(params.data,params.headers)).status,401);
  params=credentials(client.client_secret);assert.equal((await f.form({...params.data,code_verifier:token()},params.headers)).status,400);
  const r=await f.form(params.data,params.headers);assert.equal(r.status,200);const issued=await r.json();assert.ok(issued.access_token);
  const refresh={client_id:client.client_id,grant_type:'refresh_token',refresh_token:issued.refresh_token};
  if(method==='client_secret_post')refresh.client_secret=client.client_secret;
  assert.equal((await f.form(refresh,params.headers)).status,200);
 }
});
test('all published tool object schemas declare concrete properties for function-tool conversion',async t=>{
 const f=await fixture(t);const response=await f.call('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/list'});const tools=(await response.json()).result.tools;
 const visit=(node,path)=>{
  if(!node||typeof node!=='object')return;
  assert.equal(Object.hasOwn(node,'const'),false,path+' uses unsupported const instead of enum');
  if(node.type==='object'){assert.ok(node.properties&&typeof node.properties==='object',path+' object lacks properties');assert.equal(node.additionalProperties,false,path);for(const [key,value] of Object.entries(node.properties))visit(value,path+'.'+key);}
  if(node.items)visit(node.items,path+'[]');
 };
 for(const tool of tools)visit(tool.inputSchema,tool.name);
 const values=tools.find(t=>t.name==='studio_propose_changes').inputSchema.properties.commands.items.properties.values;
 for(const fields of Object.values(commandFields))for(const field of fields)assert.ok(Object.hasOwn(values.properties,field),'MCP schema missing command field: '+field);
 assert.equal(values.properties.name.type,'string');assert.equal(values.properties.completed.type,'boolean');assert.equal(values.properties.x.type,'number');assert.ok(values.properties.category.enum.includes('sd'));
});
test('manual clients require administrator consent and secret auth, never disclose saved secrets, and revoke all grants',async t=>{
 const f=await fixture(t),path='/api/connections/clients';
 f.db.prepare("INSERT INTO site_settings VALUES('admin_user_id','alpha')").run();
 const create=data=>f.call(path,'POST',data,{Origin:f.origin,Cookie:f.cookies.alpha});
 const metadata={redirectUris:[f.callback]};
 assert.equal((await f.call(path,'POST',metadata)).status,401);
 assert.equal((await f.call(path,'POST',metadata,{Origin:f.origin,Cookie:f.cookies.beta})).status,403);
 assert.equal((await f.call(path,'POST',metadata,{Origin:'https://evil.invalid',Cookie:f.cookies.alpha})).status,403);
 assert.equal((await create({redirectUris:['https://evil.invalid/callback']})).status,400);
 const response=await create(metadata);assert.equal(response.status,201);const manual=await response.json();assert.match(manual.clientSecret,/^[a-f0-9]{64}$/);
 assert.equal(f.db.prepare('SELECT secret_hash FROM oauth_clients WHERE id=?').get(manual.clientId).secret_hash,digest(manual.clientSecret));
 const client={client_id:manual.clientId},auths=[];
 for(const method of ['post','basic']){
  const pending=await f.pending(client),redirect=await f.consent(pending);
  const data={client_id:manual.clientId,redirect_uri:f.callback,grant_type:'authorization_code',code:redirect.searchParams.get('code'),code_verifier:pending.verifier};
  assert.equal((await f.form(data)).status,401);
  const headers=method==='basic'?{Authorization:'Basic '+Buffer.from(manual.clientId+':'+manual.clientSecret).toString('base64')}:{};
  if(method==='post')data.client_secret=manual.clientSecret;
  const result=await f.form(data,headers);assert.equal(result.status,200);const auth=await result.json();auths.push(auth);assert.equal((await f.rpc(auth,'studio_list_projects')).response.status,200);
 }
 const listed=await (await f.call(path,'GET',undefined,{Cookie:f.cookies.alpha})).json();assert.equal(listed.clients.length,1);assert.equal(JSON.stringify(listed).includes(manual.clientSecret),false);
 assert.equal((await f.call(path,'GET',undefined,{Cookie:f.cookies.beta})).status,403);
 const diagnostic=await (await f.call('/api/connections/diagnostics','GET',undefined,{Cookie:f.cookies.alpha})).json();assert.equal(JSON.stringify(diagnostic).includes(manual.clientSecret),false);
 assert.equal((await f.call(path+'/'+manual.clientId,'DELETE',undefined,{Origin:f.origin,Cookie:f.cookies.beta})).status,403);
 assert.equal((await f.call(path+'/'+manual.clientId,'DELETE',undefined,{Origin:f.origin,Cookie:f.cookies.alpha})).status,200);
 for(const auth of auths)assert.equal((await f.rpc(auth,'tools/list')).response.status,401);
 const p=await f.pending(await f.register());assert.ok(p.id);
 const bad=new URLSearchParams({...p.params,client_id:manual.clientId});assert.equal((await f.call('/oauth/authorize?'+bad)).status,400);
 assert.equal((await f.form({client_id:manual.clientId,client_secret:manual.clientSecret,grant_type:'refresh_token',refresh_token:auths[0].refresh_token})).status,401);
});
test('search/fetch provide account-scoped project retrieval and valid citation links',async t=>{
 const f=await fixture(t),auth=await f.connect('alpha',false);
 const tools=(await f.rpc(auth,'tools/list')).data.result.tools;assert.ok(tools.some(t=>t.name==='search'&&t.annotations.readOnlyHint));assert.ok(tools.some(t=>t.name==='fetch'&&t.annotations.readOnlyHint));
 const search=(await f.rpc(auth,'search',{query:''})).data.result.structuredContent;assert.equal(search.results.length,1);assert.equal(search.results[0].title,'Fictional alpha');assert.equal(new URL(search.results[0].url).searchParams.get('project'),'alpha-project');
 assert.deepEqual(JSON.parse((await f.rpc(auth,'search',{query:'프로젝트 목록'})).data.result.content[0].text),search);
 assert.equal((await f.rpc(auth,'search',{query:'beta'})).data.result.structuredContent.results.length,0);
 const fetched=(await f.rpc(auth,'fetch',{id:search.results[0].id})).data.result.structuredContent;assert.equal(fetched.id,search.results[0].id);assert.equal(fetched.metadata.revision,1);const document=JSON.parse(fetched.text);assert.equal(document.project.id,'alpha-project');assert.equal('settings' in document,false);
 assert.equal((await f.rpc(auth,'fetch',{id:'project:beta-project'})).data.result.isError,true);assert.equal((await f.rpc(auth,'fetch',{id:'https://evil.invalid/'})).data.result.isError,true);assert.equal((await f.rpc(auth,'search',{query:{secret:'invalid'}})).data.result.isError,true);
 const anonymous=await (await f.call('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'search',arguments:{query:''}}})).json();assert.equal(anonymous.result.isError,true);assert.ok(anonymous.result._meta['mcp/www_authenticate']);assert.equal(JSON.stringify(anonymous).includes('Fictional alpha'),false);
});

test('manual callback repair requires owner approval, exact pending URI, expiry and valid ChatGPT host',async t=>{
 const f=await fixture(t),path='/api/connections/clients';
 f.db.prepare("INSERT INTO site_settings(key,value) VALUES('admin_user_id',?)").run('alpha');
 const headers={Origin:f.origin,Cookie:f.cookies.alpha};
 const manual=await (await f.call(path,'POST',{redirectUris:[f.callback]},headers)).json();
 const p=await f.pending({client_id:manual.clientId});
 const requested='https://chatgpt.com/aip/callback/fictional';
 const authorize=async(overrides)=>{const r=await f.call('/oauth/authorize?'+new URLSearchParams({...p.params,...overrides}));return {status:r.status,data:r.status===400?await r.json():null};};
 assert.equal((await authorize({client_id:token()})).data.error,'unknown_client');
 assert.equal((await authorize({redirect_uri:requested})).data.error,'redirect_uri_mismatch');
 assert.deepEqual(JSON.parse(f.db.prepare('SELECT redirects FROM oauth_clients WHERE id=?').get(manual.clientId).redirects),[f.callback]);
 const listed=await (await f.call(path,'GET',undefined,{Cookie:f.cookies.alpha})).json();assert.equal(listed.clients[0].pendingCallback,requested);
 const endpoint=path+'/'+manual.clientId+'/callback',body={redirectUri:requested};
 assert.equal((await f.call(endpoint,'POST',body,{Cookie:f.cookies.alpha})).status,403);
 assert.equal((await f.call(endpoint,'POST',body,{Origin:f.origin,Cookie:f.cookies.beta})).status,403);
 assert.equal((await f.call(endpoint,'POST',{redirectUri:requested+'/changed'},headers)).status,409);
 assert.equal((await f.call(endpoint,'POST',body,headers)).status,200);
 assert.equal((await authorize({redirect_uri:requested})).status,302);
 assert.equal((await f.call(endpoint,'POST',body,headers)).status,409);
 await authorize({redirect_uri:requested+'/expired'});
 f.db.prepare('UPDATE oauth_callback_mismatches SET expires=0').run();
 assert.equal((await f.call(endpoint,'POST',{redirectUri:requested+'/expired'},headers)).status,409);
 for(const redirect_uri of ['https://evil.example/callback','https://chatgpt.com.evil.example/callback','https://user@chatgpt.com/callback','http://chatgpt.com/callback'])assert.equal((await authorize({redirect_uri})).data.error,'invalid_redirect_uri');
 const diagnostic=await (await f.call('/api/connections/diagnostics','GET',undefined,{Cookie:f.cookies.alpha})).json();
 assert.ok(diagnostic.events.some(e=>e.reason==='redirect_uri_mismatch'));assert.ok(diagnostic.events.some(e=>e.reason==='unknown_client'));
 assert.equal(JSON.stringify(diagnostic).includes(requested),false);assert.equal(JSON.stringify(diagnostic).includes(manual.clientId),false);
 await f.call(path+'/'+manual.clientId,'DELETE',undefined,headers);
 assert.equal((await authorize({})).data.error,'client_revoked');
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM oauth_callback_mismatches').get().n,0);
});

test('new shoot content supports proposal, confirmation, scoped layout, copy and tasks without exposing other stores',async t=>{
 const f=await fixture(t),auth=await f.connect('alpha');
 const change=async(commands)=>{
  const current=(await f.rpc(auth,'studio_get_project',{projectId:'alpha-project'})).data.result.structuredContent;
  const proposed=(await f.rpc(auth,'studio_propose_changes',{projectId:'alpha-project',revision:current.revision,commands})).data.result;
  assert.notEqual(proposed.isError,true,JSON.stringify(proposed));
  const before=(await f.rpc(auth,'studio_get_project',{projectId:'alpha-project'})).data.result.structuredContent;assert.equal(before.revision,current.revision);
  const applied=(await f.rpc(auth,'studio_apply_changes',{proposalId:proposed.structuredContent.proposalId,confirmed:true})).data.result;assert.notEqual(applied.isError,true,JSON.stringify(applied));
  return (await f.rpc(auth,'studio_get_project',{projectId:'alpha-project'})).data.result.structuredContent;
 };
 let current=await change([{operation:'add_shoot',values:{name:'Test shoot'}},{operation:'add_member',values:{name:'Test member'}},{operation:'add_equipment',values:{name:'Test camera',category:'camera'}}]);
 const p=current.project,shootId=p.contents[0].id,memberId=p.members[0].id,gearId=p.gear[0].id;
 current=await change([{operation:'configure_shoot',entityId:shootId,values:{memberIds:[memberId],gearIds:[gearId]}},{operation:'add_camera',shootId,values:{name:'Shoot camera',gearId}},{operation:'add_task',values:{name:'Prepare',shootId}},{operation:'update_project',values:{description:'Test description'}}]);
 assert.equal(current.project.cameras.length,0);assert.equal(current.project.contents[0].configuration.cameras.length,1);assert.equal(current.project.tasks[0].shootId,shootId);
 current=await change([{operation:'update_task',entityId:current.project.tasks[0].id,values:{completed:true}},{operation:'copy_shoot',entityId:shootId,values:{}}]);
 assert.equal(current.project.contents.length,2);assert.equal(current.project.tasks.length,2);assert.equal(current.project.tasks[1].completed,false);assert.notEqual(current.project.tasks[1].shootId,shootId);
 const revision=current.revision;
 for(const commands of [[{operation:'configure_shoot',entityId:shootId,values:{memberIds:['beta-member']}}],[{operation:'add_camera',shootId:'beta-shoot',values:{name:'Invalid',gearId}}],[{operation:'add_task',values:{name:'Invalid',shootId:'beta-shoot'}}]]){
  assert.equal((await f.rpc(auth,'studio_propose_changes',{projectId:'alpha-project',revision,commands})).data.result.isError,true);
 }
 current=await change([{operation:'configure_shoot',entityId:shootId,values:{gearIds:[]}}]);assert.equal(current.project.contents[0].configuration.cameras.length,0);assert.equal(current.project.contents[1].configuration.cameras.length,1);
});

test('content capability discovery does not enable pending consent or excluded tools',async t=>{
 const f=await fixture(t),auth=await f.connect('alpha');
 const listed=(await f.rpc(auth,'studio_list_projects')).data.result.structuredContent;
 assert.equal(listed.capabilities.version,2);
 assert.deepEqual(listed.capabilities.services.filter(service=>service.access==='enabled').map(service=>service.id),['projects']);
 for(const name of ['handleScripture','handleDocumentLibrary','handleInventory','handleAccounts','handleSiteRoles','settings','admin']){
  const result=await f.rpc(auth,name,{userId:'beta',path:'/api/account'});assert.equal(result.data.error.code,-32602);
 }
 assert.equal(f.db.prepare('SELECT revision FROM workspaces WHERE user_id=?').get('alpha').revision,1);
});

test('full content consent is owner-specific; documents and QT use preview/confirm/conflict/cancel isolation',async t=>{
 const f=await fixture(t),writer=await f.connect('alpha'),other=await f.connect('beta');
 const read=(auth,args)=>f.rpc(auth,'studio_read_content',args);
 assert.equal((await read(writer,{resource:'documents'})).data.result.isError,true);
 const connections=await (await f.call('/api/connections','GET',undefined,{Cookie:f.cookies.alpha})).json(),grantId=connections.connections[0].id;
 assert.equal(connections.connections[0].contentConsentVersion,0);
 assert.equal((await f.call('/api/connections/'+grantId+'/content-consent','POST',{approve:true,version:1},{Origin:f.origin,Cookie:f.cookies.beta})).status,404);
 assert.equal((await f.call('/api/connections/'+grantId+'/content-consent','POST',{approve:false,version:1},{Origin:f.origin,Cookie:f.cookies.alpha})).status,400);
 assert.equal((await f.call('/api/connections/'+grantId+'/content-consent','POST',{approve:true,version:1},{Origin:f.origin,Cookie:f.cookies.alpha})).status,200);
 assert.equal((await read(other,{resource:'documents'})).data.result.isError,true);
 const value=async args=>{const r=(await read(writer,args)).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const propose=async(args,fields)=>{const before=await value(args),r=(await f.rpc(writer,'studio_propose_content',{...args,revision:before.revision,valuesJson:JSON.stringify(fields)})).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const apply=async p=>{const r=(await f.rpc(writer,'studio_apply_changes',{proposalId:p.proposalId,confirmed:true})).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const p=await propose({resource:'documents'},{title:'Fictional private doc'});assert.equal((await value({resource:'documents'})).value.total,0);
 assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:p.proposalId,confirmed:false})).data.result.isError,true);
 assert.equal((await f.rpc(other,'studio_apply_changes',{proposalId:p.proposalId,confirmed:true})).data.result.isError,true);
 await apply(p);assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:p.proposalId,confirmed:true})).data.result.isError,true);
 let docs=await value({resource:'documents'});assert.equal(docs.value.total,1);const id=docs.value.items[0].id;
 const cancelled=await propose({resource:'documents',id},{title:'Cancelled'});assert.equal((await f.rpc(writer,'studio_cancel_proposal',{proposalId:cancelled.proposalId})).data.result.structuredContent.cancelled,true);assert.equal((await f.rpc(writer,'studio_cancel_proposal',{proposalId:cancelled.proposalId})).data.result.structuredContent.cancelled,false);assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:cancelled.proposalId,confirmed:true})).data.result.isError,true);
 const stale=await propose({resource:'documents',id},{title:'Stale'});await apply(await propose({resource:'documents',id},{title:'Current'}));assert.equal((await f.rpc(writer,'studio_apply_changes',{proposalId:stale.proposalId,confirmed:true})).data.result.structuredContent.error,'REVISION_CONFLICT');
 const sermon=await apply(await propose({resource:'notes'},{document:{title:'Partial title'}}));assert.equal(sermon.result.note.document.title,'Partial title');
 const qt=await apply(await propose({resource:'qt'},{date:'2026-10-20'}));const noteId=qt.result.note.document.id;
 const legacy=f.db.prepare('SELECT body FROM scripture_notes WHERE id=?').get(noteId),legacyNote=JSON.parse(legacy.body);delete legacyNote.qtJournal;legacyNote.document.blocks[0].content=[{text:'Legacy reflection preserved'}];f.db.prepare('UPDATE scripture_notes SET body=? WHERE id=?').run(JSON.stringify(legacyNote),noteId);
 await apply(await propose({resource:'gratitude',noteId},{text:'Fictional thanks'}));
 assert.equal(JSON.parse(f.db.prepare('SELECT body FROM scripture_notes WHERE id=?').get(noteId).body).qtJournal.word,'Legacy reflection preserved');
 const entries=await value({resource:'gratitude',noteId});assert.ok(entries.value.items.some(item=>item.text==='Fictional thanks'));
 const otherGrant=f.db.prepare('SELECT id FROM oauth_grants WHERE user_id=?').get('beta').id;f.db.prepare('INSERT INTO integration_content_consents VALUES(?,?,1,?)').run(otherGrant,'beta',Date.now());
 assert.equal((await read(other,{resource:'documents',id})).data.result.isError,true);assert.equal((await read(other,{resource:'qt',id:noteId})).data.result.isError,true);
 for(const resource of ['account','settings','admin','__proto__'])assert.equal((await read(writer,{resource})).data.result.isError,true);
 assert.equal((await f.rpc(writer,'studio_propose_content',{resource:'members',revision:(await value({resource:'members'})).revision,valuesJson:JSON.stringify({name:'Forbidden',accountId:'beta'})})).data.result.isError,true);
});

test('content adapters reuse validators for materials, references, members, inventory and permission revocation',async t=>{
 const f=await fixture(t),auth=await f.connect('alpha'),readOnly=await f.connect('beta',false);
 const grant=f.db.prepare('SELECT id FROM oauth_grants WHERE user_id=?').get('alpha');f.db.prepare('INSERT INTO integration_content_consents VALUES(?,?,1,?)').run(grant.id,'alpha',Date.now());
 const read=async target=>{const r=(await f.rpc(auth,'studio_read_content',target)).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const propose=async(target,values)=>{const current=await read(target);const r=(await f.rpc(auth,'studio_propose_content',{...target,revision:current.revision,valuesJson:JSON.stringify(values)})).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const change=async(target,values)=>{const p=await propose(target,values);const r=(await f.rpc(auth,'studio_apply_changes',{proposalId:p.proposalId,confirmed:true})).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent.result;};
 const task=(await change({resource:'tasks',projectId:'alpha-project'},{name:'Paged task'})).item;
 await change({resource:'tasks',projectId:'alpha-project',id:task.id},{completed:true});
 const shoot=(await change({resource:'shoots',projectId:'alpha-project'},{name:'Paged shoot'})).item;
 await change({resource:'shoot_configuration',projectId:'alpha-project',id:shoot.id},{rentals:[{id:'rental-test',name:'Rental plan',category:'other',owner:'',assignee:'',status:'check',isRental:true,quantity:1}]});
 const ref=(await change({resource:'references'},{name:'Fictional reference',notes:'test'})).reference;
 assert.equal((await read({resource:'references',id:ref.id})).value.name,'Fictional reference');
 await change({resource:'boards',id:ref.id},{items:[{key:'text:fictional',kind:'text',text:'Board note',title:'Test',x:0,y:0,w:4,h:4}]});
 const material=(await change({resource:'materials'},{url:'https://example.invalid/test',title:'Test material',description:'test',tags:[]})).item;
 await change({resource:'materials',id:material.id},{title:'Updated material'});
 const member=(await change({resource:'members'},{name:'Test member'})).contact;
 const gear=(await change({resource:'member_equipment',memberId:member.id},{name:'Member lens',category:'lens',quantity:2})).equipment;
 await change({resource:'member_equipment',memberId:member.id,id:gear.id},{notes:'Updated'});
 const inventory=(await change({resource:'inventory'},{name:'Fictional inventory',category:'other',quantity:2,trackingMode:'bulk'})).item;
 await change({resource:'inventory',id:inventory.id},{storageLocation:'Set A'});
 await change({resource:'vendors'},{name:'Fictional vendor',notes:'Test'});
 await change({resource:'project_documents',projectId:'alpha-project'},{title:'Project document'});
 await change({resource:'annotations',book:'창세기',chapter:1,verse:1},{memo:'Test private memo'});
 assert.equal((await read({resource:'annotations',book:'창세기',chapter:1})).value.items[0].memo,'Test private memo');
 const userGrant=f.db.prepare('SELECT id FROM oauth_grants WHERE user_id=?').get('beta');f.db.prepare('INSERT INTO integration_content_consents VALUES(?,?,1,?)').run(userGrant.id,'beta',Date.now());
 assert.equal((await f.rpc(readOnly,'studio_read_content',{resource:'references',id:ref.id})).data.result.isError,true);
 assert.equal((await f.rpc(readOnly,'studio_read_content',{resource:'member_equipment',memberId:member.id})).data.result.isError,true);
 assert.equal((await f.rpc(readOnly,'studio_propose_content',{resource:'documents',revision:'0'.repeat(64),valuesJson:'{}'})).data.error.code,-32602);
 const pending=await propose({resource:'vendors'},{name:'Revoked proposal'});f.db.prepare('DELETE FROM integration_content_consents WHERE grant_id=?').run(grant.id);
 assert.equal((await f.rpc(auth,'studio_apply_changes',{proposalId:pending.proposalId,confirmed:true})).data.result.isError,true);
});

test('new OAuth consent binds full content only to the approved grant and preserves read-only scope',async t=>{
 const f=await fixture(t),legacy=await f.connect('alpha'),full=await f.connect('alpha',false,true);
 assert.equal((await f.rpc(legacy,'studio_read_content',{resource:'documents'})).data.result.isError,true);
 const read=(await f.rpc(full,'studio_read_content',{resource:'documents'})).data.result;assert.notEqual(read.isError,true,JSON.stringify(read));
 assert.equal((await f.rpc(full,'studio_propose_content',{resource:'documents',revision:read.structuredContent.revision,valuesJson:'{"title":"No write"}'})).data.error.code,-32602);
 const token=await (await f.form({client_id:full.client.client_id,grant_type:'refresh_token',refresh_token:full.refresh_token})).json();
 assert.notEqual((await f.rpc(token,'studio_read_content',{resource:'documents'})).data.result.isError,true);
 assert.equal(f.db.prepare('SELECT count(*) n FROM integration_content_consents').get().n,1);
});

test('organization content uses existing role checks; loans/returns, expiry and shared project read-only access stay isolated',async t=>{
 const f=await fixture(t),owner=await f.connect('alpha',true,true),viewer=await f.connect('beta',true,true);
 f.db.prepare('INSERT INTO inventory_organizations VALUES(?,?,?,?)').run('test-org','alpha','Fictional org',Date.now());
 f.db.prepare('INSERT INTO inventory_memberships VALUES(?,?,?,1)').run('test-org','alpha','owner');f.db.prepare('INSERT INTO inventory_memberships VALUES(?,?,?,1)').run('test-org','beta','viewer');
 const read=async(auth,target)=>{const r=(await f.rpc(auth,'studio_read_content',target)).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const propose=async(auth,target,values)=>{const data=await read(auth,target);return (await f.rpc(auth,'studio_propose_content',{...target,revision:data.revision,valuesJson:JSON.stringify(values)})).data.result;};
 const change=async(target,values)=>{const p=await propose(owner,target,values);assert.notEqual(p.isError,true,JSON.stringify(p));const applied=(await f.rpc(owner,'studio_apply_changes',{proposalId:p.structuredContent.proposalId,confirmed:true})).data.result;assert.notEqual(applied.isError,true,JSON.stringify(applied));return applied.structuredContent.result;};
 const gear=(await change({resource:'inventory'},{name:'Org kit',category:'other',ownership:'organization',organizationId:'test-org',trackingMode:'bulk',quantity:2})).item;
 const orgs=await read(viewer,{resource:'organizations'});assert.deepEqual(Object.keys(orgs.value.items[0]).sort(),['id','name']);
 const seen=await read(viewer,{resource:'inventory',id:gear.id});assert.equal(seen.value.id,gear.id);
 assert.equal((await propose(viewer,{resource:'inventory',id:gear.id},{name:'Forbidden'})).isError,true);
 const loan=(await change({resource:'loans'},{borrower:'Fictional borrower',dueAt:'2099-01-01T12:00:00Z',lines:[{equipmentId:gear.id,quantity:1}]})).loan;
 await change({resource:'returns',id:loan.id},{note:'Returned',lines:[{lineId:loan.lines[0].id,quantity:1}]});
 const expired=await propose(owner,{resource:'vendors'},{name:'Expired'});f.db.prepare('UPDATE integration_content_proposals SET expires=0 WHERE id=?').run(expired.structuredContent.proposalId);assert.equal((await f.rpc(owner,'studio_apply_changes',{proposalId:expired.structuredContent.proposalId,confirmed:true})).data.result.isError,true);
 const pending=await propose(owner,{resource:'inventory',id:gear.id},{name:'No longer permitted'});f.db.prepare('UPDATE inventory_memberships SET active=0 WHERE org_id=? AND user_id=?').run('test-org','alpha');
 assert.equal((await f.rpc(owner,'studio_apply_changes',{proposalId:pending.structuredContent.proposalId,confirmed:true})).data.result.isError,true);
 assert.equal((await f.rpc(viewer,'studio_read_content',{resource:'shared_projects',ownerId:'alpha',id:'alpha-project'})).data.result.isError,true);
 f.db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run('alpha','alpha-project','beta','member-test',Date.now());
 assert.equal((await read(viewer,{resource:'shared_projects',ownerId:'alpha',id:'alpha-project'})).value.project.id,'alpha-project');
 assert.equal((await propose(viewer,{resource:'shared_projects',ownerId:'alpha',id:'alpha-project'},{name:'Cannot edit shared'})).isError,true);
});

test('paged document blocks update one item, preserve neighboring content and stay bounded',async t=>{
 const f=await fixture(t),auth=await f.connect('alpha',true,true);
 const read=async target=>{const r=(await f.rpc(auth,'studio_read_content',target)).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent;};
 const change=async(target,values)=>{const revision=(await read(target)).revision,p=(await f.rpc(auth,'studio_propose_content',{...target,revision,valuesJson:JSON.stringify(values)})).data.result;assert.notEqual(p.isError,true,JSON.stringify(p));const r=(await f.rpc(auth,'studio_apply_changes',{proposalId:p.structuredContent.proposalId,confirmed:true})).data.result;assert.notEqual(r.isError,true,JSON.stringify(r));return r.structuredContent.result;};
 const doc=(await change({resource:'documents'},{title:'Block test'})).document;
 const initial=(await read({resource:'document_blocks',id:doc.id})).value.items[0];
 const added=(await change({resource:'document_blocks',id:doc.id},{type:'paragraph',content:[{text:'Preserved neighbor'}]})).block;
 await change({resource:'document_blocks',id:doc.id,blockId:initial.id},{content:[{text:'Updated first'}]});
 let page=await read({resource:'document_blocks',id:doc.id,limit:1});assert.equal(page.value.items.length,1);assert.equal(page.value.nextOffset,1);
 page=await read({resource:'documents',id:doc.id,field:'blocks',offset:1,limit:1});assert.equal(page.value.items[0].id,added.id);assert.equal(page.value.items[0].content[0].text,'Preserved neighbor');
 assert.equal((await read({resource:'documents',id:doc.id})).value.blockCount,2);
 const denied=(await f.rpc(auth,'studio_read_content',{resource:'documents',id:doc.id,field:'__proto__.password'})).data.result;assert.equal(denied.isError,true);
 const duplicate=await read({resource:'catalog',limit:1,offset:1});assert.equal(duplicate.value.items.length,1);assert.ok(duplicate.value.nextOffset>=2);
});
