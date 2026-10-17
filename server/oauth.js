import {accountActive,passwordChangeRequired} from './accounts.js';
import {createHash,randomUUID} from 'node:crypto';
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
 const scopes=['studio:read','studio:write'];let registrationTimes=[];
 const cleanup=()=>{const now=Date.now();db.prepare('DELETE FROM oauth_requests WHERE expires<?').run(now);db.prepare('DELETE FROM oauth_codes WHERE expires<?').run(now);db.prepare('DELETE FROM integration_proposals WHERE expires<?').run(now);db.prepare('DELETE FROM oauth_grants WHERE refresh_expires<?').run(now);};
 const cleanScope=value=>{const requested=String(value||'studio:read').split(' ').filter(Boolean);if(!requested.includes('studio:read')||requested.some(s=>!scopes.includes(s)))throw fail('invalid_scope');return [...new Set(requested)].join(' ');};
 const callback=value=>{let url;try{url=new URL(value);}catch{throw fail('invalid_redirect_uri');}if(url.protocol!=='https:'||!callbacks.has(url.hostname)||url.username||url.password||url.hash||url.port)throw fail('invalid_redirect_uri');return url.href;};
 const issue=(uid,client,scope)=>{
  cleanup();if(db.prepare('SELECT count(*) AS n FROM oauth_grants WHERE user_id=? AND revoked=0').get(uid).n>=30)throw fail('connection_limit',429);
  const access=token(),refresh=token(),now=Date.now(),id=randomUUID();
  db.prepare('INSERT INTO oauth_grants VALUES(?,?,?,?,?,?,?,?,?,?,0)').run(id,uid,client,resource,scope,digest(access),digest(refresh),now+3600000,now+30*86400000,now);
  return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope};
 };
 const authenticate=req=>{
  const raw=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const grant=raw?db.prepare('SELECT * FROM oauth_grants WHERE access_hash=? AND access_expires>? AND refresh_expires>? AND revoked=0 AND resource=?').get(digest(raw),Date.now(),Date.now(),resource):undefined;return grant&&accountActive(db,grant.user_id)&&!passwordChangeRequired(db,grant.user_id)?grant:undefined;
 };
 async function routes({path,url,req,res,json,body,readJson,session}){
  if(path.startsWith('/.well-known/')){
   if(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'].includes(path)){json(200,{resource,authorization_servers:[origin],scopes_supported:scopes,bearer_methods_supported:['header'],resource_name:'Studio'});return true;}
   if(path==='/.well-known/oauth-authorization-server'){json(200,{issuer:origin,authorization_endpoint:origin+'/oauth/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/oauth/register',revocation_endpoint:origin+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:scopes});return true;}
   return false;
  }
  if(path==='/oauth/register'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   const now=Date.now();registrationTimes=registrationTimes.filter(t=>t>now-60000);if(registrationTimes.length>=30)throw fail('rate_limit',429);registrationTimes.push(now);
   const data=await readJson(16384);if(!Array.isArray(data.redirect_uris)||data.redirect_uris.length<1||data.redirect_uris.length>5||data.token_endpoint_auth_method&&data.token_endpoint_auth_method!=='none')throw fail('invalid_client_metadata');
   if(db.prepare('SELECT count(*) AS n FROM oauth_clients').get().n>=10000)throw fail('registration_limit',429);
   const redirects=data.redirect_uris.map(callback),id=token();db.prepare('INSERT INTO oauth_clients VALUES(?,?,?)').run(id,JSON.stringify(redirects),now);
   json(201,{client_id:id,client_id_issued_at:Math.floor(now/1000),redirect_uris:redirects,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']});return true;
  }
  if(path==='/oauth/authorize'&&req.method==='GET'){
   cleanup();const q=url.searchParams,client=db.prepare('SELECT * FROM oauth_clients WHERE id=?').get(q.get('client_id'));
   if(!client||!JSON.parse(client.redirects).includes(q.get('redirect_uri')))throw fail('invalid_client_or_redirect');
   if(q.get('response_type')!=='code'||q.get('resource')!==resource||q.get('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge')||'')||(q.get('state')||'').length>2000)throw fail('invalid_request');
   if(db.prepare('SELECT count(*) AS n FROM oauth_requests').get().n>=1000)throw fail('request_limit',429);
   const id=token();db.prepare('INSERT INTO oauth_requests VALUES(?,?,?,?,?,?,?)').run(id,client.id,q.get('redirect_uri'),q.get('code_challenge'),cleanScope(q.get('scope')),q.get('state')||'',Date.now()+600000);
   res.writeHead(302,{Location:origin+'/?connect='+id});res.end();return true;
  }
  if(path==='/oauth/token'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))throw fail('unsupported_media_type',415);
   const form=new URLSearchParams((await body(16384)).toString());if(form.get('resource')!==resource)throw fail('invalid_target');
   const client=form.get('client_id');if(!client||!db.prepare('SELECT id FROM oauth_clients WHERE id=?').get(client))throw fail('invalid_client');
   if(form.get('grant_type')==='authorization_code'){
    const raw=form.get('code'),verifier=form.get('code_verifier')||'';if(!raw||!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw fail('invalid_grant');
    const code=db.prepare('SELECT * FROM oauth_codes WHERE hash=? AND expires>?').get(digest(raw),Date.now());
    if(!code||!accountActive(db,code.user_id)||passwordChangeRequired(db,code.user_id)||code.client_id!==client||code.redirect_uri!==form.get('redirect_uri')||createHash('sha256').update(verifier).digest('base64url')!==code.challenge)throw fail('invalid_grant');
    db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM oauth_codes WHERE hash=?').run(code.hash);const result=issue(code.user_id,client,code.scope);db.exec('COMMIT');json(200,result);}catch(e){db.exec('ROLLBACK');throw e;}return true;
   }
   if(form.get('grant_type')==='refresh_token'){
    const raw=form.get('refresh_token');if(!raw)throw fail('invalid_grant');
    const grant=db.prepare('SELECT * FROM oauth_grants WHERE refresh_hash=? AND client_id=? AND refresh_expires>? AND revoked=0 AND resource=?').get(digest(raw),client,Date.now(),resource);if(!grant||!accountActive(db,grant.user_id)||passwordChangeRequired(db,grant.user_id))throw fail('invalid_grant');
    const access=token(),refresh=token();db.prepare('UPDATE oauth_grants SET access_hash=?,refresh_hash=?,access_expires=? WHERE id=?').run(digest(access),digest(refresh),Date.now()+3600000,grant.id);
    json(200,{access_token:access,refresh_token:refresh,token_type:'Bearer',expires_in:3600,scope:grant.scope});return true;
   }
   throw fail('unsupported_grant_type');
  }
  if(path==='/oauth/revoke'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   const form=new URLSearchParams((await body(16384)).toString());const raw=form.get('token');if(raw&&form.get('client_id'))db.prepare('UPDATE oauth_grants SET revoked=1 WHERE client_id=? AND (access_hash=? OR refresh_hash=?)').run(form.get('client_id'),digest(raw),digest(raw));json(200,{});return true;
  }
  if(path==='/api/connections'||path.startsWith('/api/connections/')){
   if(!session)throw fail('Login required',401);
   if(passwordChangeRequired(db,session.user_id))throw fail('PASSWORD_CHANGE_REQUIRED',403);
   if(req.method!=='GET'&&req.headers.origin!==origin)throw fail('Origin rejected',403);
   if(path==='/api/connections'&&req.method==='GET'){
    cleanup();json(200,{endpoint:resource,connections:db.prepare('SELECT id,scope,created_at,refresh_expires FROM oauth_grants WHERE user_id=? AND revoked=0 ORDER BY created_at DESC').all(session.user_id)});return true;
   }
   const requestId=path.match(/^\/api\/connections\/requests\/([a-f0-9]{64})$/)?.[1];
   if(requestId&&req.method==='GET'){
    const pending=db.prepare('SELECT scope,redirect_uri FROM oauth_requests WHERE id=? AND expires>?').get(requestId,Date.now());if(!pending)throw fail('연결 요청이 만료되었습니다.',404);json(200,pending);return true;
   }
   if(path==='/api/connections/authorize'&&req.method==='POST'){
    const data=await readJson(16384);if(!data||typeof data.requestId!=='string')throw fail('invalid_request');
    const pending=db.prepare('SELECT * FROM oauth_requests WHERE id=? AND expires>?').get(data.requestId,Date.now());if(!pending)throw fail('연결 요청이 만료되었습니다.',404);
    const redirect=new URL(pending.redirect_uri);if(pending.state)redirect.searchParams.set('state',pending.state);
    if(data.approve!==true){redirect.searchParams.set('error','access_denied');}
    else{const scope=data.allowWrite===true?pending.scope:'studio:read',code=token();db.prepare('INSERT INTO oauth_codes VALUES(?,?,?,?,?,?,?)').run(digest(code),pending.client_id,session.user_id,pending.redirect_uri,pending.challenge,scope,Date.now()+120000);redirect.searchParams.set('code',code);}
    db.prepare('DELETE FROM oauth_requests WHERE id=?').run(pending.id);json(200,{redirect:redirect.href});return true;
   }
   const id=path.match(/^\/api\/connections\/([a-f0-9-]{36})$/)?.[1];if(id&&req.method==='DELETE'){db.prepare('UPDATE oauth_grants SET revoked=1 WHERE id=? AND user_id=?').run(id,session.user_id);db.prepare('DELETE FROM integration_proposals WHERE grant_id=? AND user_id=?').run(id,session.user_id);json(200,{ok:true});return true;}
   throw fail('Not found',404);
  }
  return false;
 }
 return {routes,authenticate,resource,cleanup};
}
