import {accountActive,passwordChangeRequired} from './accounts.js';
import {isAdmin} from './invitations.js';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {token,digest} from './auth.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const callbacks=new Set(['chatgpt.com','chat.openai.com']);
export function oauthService(db,origin){
 const resource=origin+'/mcp';
 db.exec(`CREATE TABLE IF NOT EXISTS oauth_clients(id TEXT PRIMARY KEY,redirects TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_requests(id TEXT PRIMARY KEY,client_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,challenge TEXT NOT NULL,scope TEXT NOT NULL,state TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_codes(hash TEXT PRIMARY KEY,client_id TEXT NOT NULL,user_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,challenge TEXT NOT NULL,scope TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_grants(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,resource TEXT NOT NULL,scope TEXT NOT NULL,access_hash TEXT UNIQUE NOT NULL,refresh_hash TEXT UNIQUE NOT NULL,access_expires INTEGER NOT NULL,refresh_expires INTEGER NOT NULL,created_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS integration_proposals(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL,user_id TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,impact TEXT NOT NULL,expires INTEGER NOT NULL);`);
 db.exec('CREATE TABLE IF NOT EXISTS oauth_manual_clients(client_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0)');
 db.exec('CREATE TABLE IF NOT EXISTS oauth_callback_mismatches(client_id TEXT PRIMARY KEY,redirect_uri TEXT NOT NULL,expires INTEGER NOT NULL)');
 const clientColumns=db.prepare('PRAGMA table_info(oauth_clients)').all().map(c=>c.name);
 if(!clientColumns.includes('auth_method'))db.exec("ALTER TABLE oauth_clients ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'none'");
 if(!clientColumns.includes('secret_hash'))db.exec('ALTER TABLE oauth_clients ADD COLUMN secret_hash TEXT');
 const clientMethods=['none','client_secret_post','client_secret_basic'];
 const clientAuthentication=(req,form)=>{
  let id=form.get('client_id'),secret=form.get('client_secret'),method=secret?'client_secret_post':'none';
  if(req.headers.authorization){
   const encoded=req.headers.authorization.match(/^Basic ([A-Za-z0-9+/]+=*)$/i)?.[1];if(!encoded)throw fail('invalid_client',401);
   const decoded=Buffer.from(encoded,'base64').toString(),split=decoded.indexOf(':');if(split<0)throw fail('invalid_client',401);
   const basicId=decoded.slice(0,split);if((id&&id!==basicId)||secret)throw fail('invalid_client',401);
   id=basicId;secret=decoded.slice(split+1);method='client_secret_basic';
  }
  if(typeof id!=='string'||id.length>256)throw fail('invalid_client',401);
  const client=db.prepare('SELECT * FROM oauth_clients WHERE id=?').get(id);
  const manual=client&&db.prepare('SELECT revoked FROM oauth_manual_clients WHERE client_id=?').get(client.id);
  if(!client||manual?.revoked||(client.auth_method!==method&&!(manual&&client.auth_method==='client_secret_post'&&method==='client_secret_basic')))throw fail('invalid_client',401);
  if(method!=='none'&&(typeof secret!=='string'||secret.length>256||!client.secret_hash||!timingSafeEqual(Buffer.from(digest(secret),'hex'),Buffer.from(client.secret_hash,'hex'))))throw fail('invalid_client',401);
  return client.id;
 };
 const liveAccount=uid=>Boolean(db.prepare('SELECT id FROM users WHERE id=?').get(uid)&&accountActive(db,uid)&&!passwordChangeRequired(db,uid));
 const liveSession=(session,{admin=false}={})=>{
  if(!session?.user_id||!db.prepare('SELECT id FROM users WHERE id=?').get(session.user_id)||!accountActive(db,session.user_id)||!session.token||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,session.user_id,Date.now()))throw fail('Login required',401);
  if(passwordChangeRequired(db,session.user_id))throw fail('PASSWORD_CHANGE_REQUIRED',403);
  if(admin&&!isAdmin(db,session.user_id))throw fail('Administrator required',403);
 };
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 const scopes=['studio:read','studio:write'];let registrationTimes=[];
 const cleanup=()=>{const now=Date.now();db.prepare('DELETE FROM oauth_callback_mismatches WHERE expires<=?').run(now);db.prepare('DELETE FROM oauth_requests WHERE expires<?').run(now);db.prepare('DELETE FROM oauth_codes WHERE expires<?').run(now);db.prepare('DELETE FROM integration_proposals WHERE expires<?').run(now);db.prepare('DELETE FROM oauth_grants WHERE refresh_expires<?').run(now);};
 const cleanScope=value=>{const requested=String(value||'studio:read').split(' ').filter(Boolean);if(!requested.includes('studio:read')||requested.some(s=>!scopes.includes(s)))throw fail('invalid_scope');return [...new Set(requested)].join(' ');};
 const callback=value=>{if(typeof value!=='string'||value.length>2048)throw fail('invalid_redirect_uri');let url;try{url=new URL(value);}catch{throw fail('invalid_redirect_uri');}if(url.protocol!=='https:'||!callbacks.has(url.hostname)||url.username||url.password||url.hash||url.port)throw fail('invalid_redirect_uri');return url.href;};
 const issue=(uid,client,scope)=>{
  if(!liveAccount(uid))throw fail('invalid_grant');cleanup();if(db.prepare('SELECT count(*) AS n FROM oauth_grants WHERE user_id=? AND revoked=0').get(uid).n>=30)throw fail('connection_limit',429);
  const access=token(),refresh=token(),now=Date.now(),id=randomUUID();
  db.prepare('INSERT INTO oauth_grants VALUES(?,?,?,?,?,?,?,?,?,?,0)').run(id,uid,client,resource,scope,digest(access),digest(refresh),now+3600000,now+30*86400000,now);
  return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope};
 };
 const authenticate=req=>{
  const raw=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const grant=raw?db.prepare('SELECT * FROM oauth_grants WHERE access_hash=? AND access_expires>? AND refresh_expires>? AND revoked=0 AND resource=? AND NOT EXISTS(SELECT 1 FROM oauth_manual_clients m WHERE m.client_id=oauth_grants.client_id AND m.revoked=1)').get(digest(raw),Date.now(),Date.now(),resource):undefined;return grant&&liveAccount(grant.user_id)?grant:undefined;
 };
 async function routes({path,url,req,res,json,body,readJson,session}){
  if(path.startsWith('/.well-known/')){
   if(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)){json(200,{resource,authorization_servers:[origin],scopes_supported:scopes,bearer_methods_supported:['header'],resource_name:'Studio'});return true;}
   if(path==='/.well-known/oauth-authorization-server'){json(200,{issuer:origin,authorization_endpoint:origin+'/oauth/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/oauth/register',revocation_endpoint:origin+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:clientMethods,scopes_supported:scopes});return true;}
   return false;
  }
  if(path==='/oauth/register'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   const now=Date.now();registrationTimes=registrationTimes.filter(t=>t>now-60000);if(registrationTimes.length>=30)throw fail('rate_limit',429);registrationTimes.push(now);
   const data=await readJson(16384);if(!data||!Array.isArray(data.redirect_uris)||data.redirect_uris.length<1||data.redirect_uris.length>5||data.token_endpoint_auth_method!==undefined&&!clientMethods.includes(data.token_endpoint_auth_method))throw fail('invalid_client_metadata');
   const redirects=data.redirect_uris.map(callback),id=token(),method=data.token_endpoint_auth_method||'none',secret=method==='none'?null:token();transaction(()=>{if(db.prepare('SELECT count(*) AS n FROM oauth_clients').get().n>=10000)throw fail('registration_limit',429);db.prepare('INSERT INTO oauth_clients(id,redirects,created_at,auth_method,secret_hash) VALUES(?,?,?,?,?)').run(id,JSON.stringify(redirects),now,method,secret?digest(secret):null);});
   json(201,{client_id:id,client_id_issued_at:Math.floor(now/1000),redirect_uris:redirects,token_endpoint_auth_method:method,...(secret?{client_secret:secret,client_secret_expires_at:0}:{}),grant_types:['authorization_code','refresh_token'],response_types:['code']});return true;
  }
  if(path==='/oauth/authorize'&&req.method==='GET'){
   cleanup();const q=url.searchParams,client=db.prepare('SELECT * FROM oauth_clients WHERE id=?').get(q.get('client_id'));
   if(!client)throw fail('unknown_client');
   const manual=db.prepare('SELECT revoked FROM oauth_manual_clients WHERE client_id=?').get(client.id);
   if(manual?.revoked)throw fail('client_revoked');
   if(q.get('response_type')!=='code'||q.get('resource')!==resource||q.get('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge')||'')||(q.get('state')||'').length>2000)throw fail('invalid_request');
   if(!JSON.parse(client.redirects).includes(q.get('redirect_uri'))){
    const redirect=callback(q.get('redirect_uri'));
    if(manual)db.prepare('INSERT INTO oauth_callback_mismatches VALUES(?,?,?) ON CONFLICT(client_id) DO UPDATE SET redirect_uri=excluded.redirect_uri,expires=excluded.expires').run(client.id,redirect,Date.now()+600000);
    throw fail('redirect_uri_mismatch');
   }
   if(db.prepare('SELECT count(*) AS n FROM oauth_requests').get().n>=1000)throw fail('request_limit',429);
   const id=token();db.prepare('INSERT INTO oauth_requests VALUES(?,?,?,?,?,?,?)').run(id,client.id,q.get('redirect_uri'),q.get('code_challenge'),cleanScope(q.get('scope')),q.get('state')||'',Date.now()+600000);
   res.writeHead(302,{Location:origin+'/?connect='+id});res.end();return true;
  }
  if(path==='/oauth/token'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))throw fail('unsupported_media_type',415);
   const form=new URLSearchParams((await body(16384)).toString());if(form.get('resource')!==resource)throw fail('invalid_target');
   const client=clientAuthentication(req,form);
   if(form.get('grant_type')==='authorization_code'){
    const raw=form.get('code'),verifier=form.get('code_verifier')||'';if(!raw||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw fail('invalid_grant');
    const result=transaction(()=>{clientAuthentication(req,form);const code=db.prepare('SELECT * FROM oauth_codes WHERE hash=? AND expires>?').get(digest(raw),Date.now());
     if(!code||!liveAccount(code.user_id)||code.client_id!==client||code.redirect_uri!==form.get('redirect_uri')||createHash('sha256').update(verifier).digest('base64url')!==code.challenge)throw fail('invalid_grant');
     if(!db.prepare('DELETE FROM oauth_codes WHERE hash=? AND expires>?').run(code.hash,Date.now()).changes)throw fail('invalid_grant');return issue(code.user_id,client,code.scope);});json(200,result);return true;
   }
   if(form.get('grant_type')==='refresh_token'){
    const raw=form.get('refresh_token');if(!raw)throw fail('invalid_grant');
    const result=transaction(()=>{clientAuthentication(req,form);const grant=db.prepare('SELECT * FROM oauth_grants WHERE refresh_hash=? AND client_id=? AND refresh_expires>? AND revoked=0 AND resource=? AND NOT EXISTS(SELECT 1 FROM oauth_manual_clients m WHERE m.client_id=oauth_grants.client_id AND m.revoked=1)').get(digest(raw),client,Date.now(),resource);if(!grant||!liveAccount(grant.user_id))throw fail('invalid_grant');
     const access=token(),refresh=token();const changed=db.prepare('UPDATE oauth_grants SET access_hash=?,refresh_hash=?,access_expires=? WHERE id=? AND refresh_hash=? AND revoked=0 AND refresh_expires>?').run(digest(access),digest(refresh),Date.now()+3600000,grant.id,grant.refresh_hash,Date.now());if(!changed.changes)throw fail('invalid_grant');return {access_token:access,refresh_token:refresh,token_type:'Bearer',expires_in:3600,scope:grant.scope};});json(200,result);return true;
   }
   throw fail('unsupported_grant_type');
  }
  if(path==='/oauth/revoke'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   const form=new URLSearchParams((await body(16384)).toString()),client=clientAuthentication(req,form),raw=form.get('token');if(raw)db.prepare('UPDATE oauth_grants SET revoked=1 WHERE client_id=? AND (access_hash=? OR refresh_hash=?)').run(client,digest(raw),digest(raw));json(200,{});return true;
  }
  if(path==='/api/connections'||path.startsWith('/api/connections/')){
   liveSession(session);
   if(req.method!=='GET'&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   if(path==='/api/connections/clients'&&req.method==='GET'){
    if(!isAdmin(db,session.user_id))throw fail('Administrator required',403);
    cleanup();json(200,{clients:db.prepare('SELECT c.id,c.redirects,m.created_at,p.redirect_uri AS pending_callback FROM oauth_clients c JOIN oauth_manual_clients m ON m.client_id=c.id LEFT JOIN oauth_callback_mismatches p ON p.client_id=c.id WHERE m.owner_id=? AND m.revoked=0 ORDER BY m.created_at DESC').all(session.user_id).map(c=>({id:c.id,redirectUris:JSON.parse(c.redirects),createdAt:c.created_at,pendingCallback:c.pending_callback||null}))});return true;
   }
   if(path==='/api/connections/clients'&&req.method==='POST'){
    if(!isAdmin(db,session.user_id))throw fail('Administrator required',403);
    const data=await readJson(16384);
    if(!data||!Array.isArray(data.redirectUris)||data.redirectUris.length<1||data.redirectUris.length>5)throw fail('invalid_client_metadata');
    const redirects=[...new Set(data.redirectUris.map(callback))];
    const id=token(),secret=token(),now=Date.now();
    transaction(()=>{liveSession(session,{admin:true});if(db.prepare('SELECT count(*) AS n FROM oauth_manual_clients WHERE owner_id=? AND revoked=0').get(session.user_id).n>=10)throw fail('manual_client_limit',429);
     db.prepare('INSERT INTO oauth_clients(id,redirects,created_at,auth_method,secret_hash) VALUES(?,?,?,?,?)').run(id,JSON.stringify(redirects),now,'client_secret_post',digest(secret));db.prepare('INSERT INTO oauth_manual_clients VALUES(?,?,?,0)').run(id,session.user_id,now);});
    json(201,{clientId:id,clientSecret:secret,redirectUris:redirects});return true;
   }
   const callbackId=path.match(/^\/api\/connections\/clients\/([a-f0-9]{64})\/callback$/)?.[1];
   if(callbackId&&req.method==='POST'){
    if(!isAdmin(db,session.user_id))throw fail('Administrator required',403);
    const data=await readJson(4096);
    transaction(()=>{liveSession(session,{admin:true});const client=db.prepare('SELECT c.redirects FROM oauth_clients c JOIN oauth_manual_clients m ON m.client_id=c.id WHERE c.id=? AND m.owner_id=? AND m.revoked=0').get(callbackId,session.user_id);if(!client)throw fail('Not found',404);
     const pending=db.prepare('SELECT redirect_uri,expires FROM oauth_callback_mismatches WHERE client_id=? AND expires>?').get(callbackId,Date.now());if(!pending||data?.redirectUri!==pending.redirect_uri)throw fail('callback_request_expired',409);
     const redirects=[...new Set([...JSON.parse(client.redirects),callback(pending.redirect_uri)])];if(redirects.length>5)throw fail('invalid_client_metadata');
     const changed=db.prepare('UPDATE oauth_clients SET redirects=? WHERE id=? AND redirects=? AND EXISTS(SELECT 1 FROM oauth_manual_clients m WHERE m.client_id=oauth_clients.id AND m.owner_id=? AND m.revoked=0)').run(JSON.stringify(redirects),callbackId,client.redirects,session.user_id);if(!changed.changes)throw fail('callback_request_expired',409);
     const consumed=db.prepare('DELETE FROM oauth_callback_mismatches WHERE client_id=? AND redirect_uri=? AND expires=? AND expires>?').run(callbackId,pending.redirect_uri,pending.expires,Date.now());if(!consumed.changes)throw fail('callback_request_expired',409);
    });
    json(200,{ok:true});return true;
   }
   const manualId=path.match(/^\/api\/connections\/clients\/([a-f0-9]{64})$/)?.[1];
   if(manualId&&req.method==='DELETE'){
    if(!isAdmin(db,session.user_id))throw fail('Administrator required',403);
    transaction(()=>{liveSession(session,{admin:true});
    const changed=db.prepare('UPDATE oauth_manual_clients SET revoked=1 WHERE client_id=? AND owner_id=? AND revoked=0').run(manualId,session.user_id);
    if(!changed.changes)throw fail('Not found',404);
    db.prepare('DELETE FROM oauth_callback_mismatches WHERE client_id=?').run(manualId);
    db.prepare('UPDATE oauth_grants SET revoked=1 WHERE client_id=?').run(manualId);
    db.prepare('DELETE FROM integration_proposals WHERE grant_id IN (SELECT id FROM oauth_grants WHERE client_id=?)').run(manualId);
    db.prepare('DELETE FROM oauth_requests WHERE client_id=?').run(manualId);db.prepare('DELETE FROM oauth_codes WHERE client_id=?').run(manualId);
    });
    json(200,{ok:true});return true;
   }
   if(path==='/api/connections'&&req.method==='GET'){
    cleanup();json(200,{endpoint:resource,connections:db.prepare('SELECT id,scope,created_at,refresh_expires FROM oauth_grants WHERE user_id=? AND revoked=0 ORDER BY created_at DESC').all(session.user_id)});return true;
   }
   const requestId=path.match(/^\/api\/connections\/requests\/([a-f0-9]{64})$/)?.[1];
   if(requestId&&req.method==='GET'){
    const pending=db.prepare('SELECT scope,redirect_uri FROM oauth_requests WHERE id=? AND expires>?').get(requestId,Date.now());if(!pending)throw fail('연결 요청이 만료되었습니다.',404);json(200,pending);return true;
   }
   if(path==='/api/connections/authorize'&&req.method==='POST'){
    const data=await readJson(16384);if(!data||typeof data.requestId!=='string')throw fail('invalid_request');
    const redirect=transaction(()=>{liveSession(session);const pending=db.prepare('SELECT * FROM oauth_requests WHERE id=? AND expires>?').get(data.requestId,Date.now());if(!pending)throw fail('연결 요청이 만료되었습니다.',404);
     const client=db.prepare('SELECT redirects FROM oauth_clients WHERE id=? AND NOT EXISTS(SELECT 1 FROM oauth_manual_clients m WHERE m.client_id=oauth_clients.id AND m.revoked=1)').get(pending.client_id);if(!client||!JSON.parse(client.redirects).includes(pending.redirect_uri))throw fail('client_revoked',409);
     const redirect=new URL(pending.redirect_uri);if(pending.state)redirect.searchParams.set('state',pending.state);
     if(!db.prepare('DELETE FROM oauth_requests WHERE id=? AND expires>?').run(pending.id,Date.now()).changes)throw fail('연결 요청이 만료되었습니다.',404);
     if(data.approve!==true)redirect.searchParams.set('error','access_denied');else{const scope=data.allowWrite===true?cleanScope(pending.scope):'studio:read',code=token();db.prepare('INSERT INTO oauth_codes VALUES(?,?,?,?,?,?,?)').run(digest(code),pending.client_id,session.user_id,pending.redirect_uri,pending.challenge,scope,Date.now()+120000);redirect.searchParams.set('code',code);}return redirect;
    });json(200,{redirect:redirect.href});return true;
   }
   const id=path.match(/^\/api\/connections\/([a-f0-9-]{36})$/)?.[1];if(id&&req.method==='DELETE'){transaction(()=>{liveSession(session);db.prepare('UPDATE oauth_grants SET revoked=1 WHERE id=? AND user_id=?').run(id,session.user_id);db.prepare('DELETE FROM integration_proposals WHERE grant_id=? AND user_id=?').run(id,session.user_id);});json(200,{ok:true});return true;}
   throw fail('Not found',404);
  }
  return false;
 }
 return {routes,authenticate,resource,cleanup};
}
