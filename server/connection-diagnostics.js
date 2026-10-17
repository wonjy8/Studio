// Store only allowlisted protocol outcomes. Never retain bodies, URLs, headers or credentials.
const methods=new Set(['none','client_secret_post','client_secret_basic']);
const errors=new Set(['invalid_client_metadata','invalid_redirect_uri','invalid_client','invalid_client_or_redirect','invalid_request','invalid_scope','invalid_target','invalid_grant','unsupported_grant_type','unsupported_media_type','rate_limit','registration_limit','request_limit','connection_limit','invalid_token','Origin rejected','tool_auth_required','tool_rejected']);
export function connectionDiagnostics(db){
 db.exec('CREATE TABLE IF NOT EXISTS connection_diagnostics(id INTEGER PRIMARY KEY,created_at INTEGER NOT NULL,stage TEXT NOT NULL,status INTEGER NOT NULL,reason TEXT NOT NULL,details TEXT NOT NULL)');
 function metadata(data){
  const result={};
  if(data&&typeof data==='object'){
   result.authMethod=data.token_endpoint_auth_method===undefined?'default':methods.has(data.token_endpoint_auth_method)?data.token_endpoint_auth_method:'unsupported';
   if(Array.isArray(data.redirect_uris))result.callbackHosts=[...new Set(data.redirect_uris.slice(0,5).map(value=>{try{return typeof value==='string'?new URL(value).hostname:'invalid';}catch{return 'invalid';}}))];
  }
  return result;
 }
 function toolMetadata(data){const names=['search','fetch','studio_list_projects','studio_get_project','studio_propose_changes','studio_apply_changes'];return data?.method==='tools/call'&&names.includes(data.params?.name)?{tool:data.params.name}:{};}
 function stage(path,data){
  if(path==='/.well-known/oauth-authorization-server')return 'oauth_metadata';
  if(path==='/.well-known/oauth-protected-resource'||path==='/.well-known/oauth-protected-resource/mcp')return 'resource_metadata';
  if(path==='/oauth/register')return 'client_registration';
  if(path==='/oauth/authorize')return 'authorization';
  if(path==='/oauth/token')return 'token_exchange';
  if(path==='/mcp')return data?.method==='tools/list'?'tool_discovery':data?.method==='initialize'?'mcp_initialize':data?.method==='tools/call'?'tool_call':'mcp_request';
  return null;
 }
 function record(name,status,reason,details={}){
  if(!name)return;
  try{const now=Date.now();db.prepare('INSERT INTO connection_diagnostics(created_at,stage,status,reason,details) VALUES(?,?,?,?,?)').run(now,name,status,errors.has(reason)?reason:status<400?'ok':'request_rejected',JSON.stringify(details));db.prepare('DELETE FROM connection_diagnostics WHERE created_at<? OR id NOT IN (SELECT id FROM connection_diagnostics ORDER BY id DESC LIMIT 100)').run(now-86400000);}catch{/* Diagnostics must not break account operations. */}
 }
 return {metadata,toolMetadata,stage,record,list:()=>db.prepare('SELECT created_at,stage,status,reason,details FROM connection_diagnostics WHERE created_at>? ORDER BY id DESC LIMIT 30').all(Date.now()-86400000).map(r=>({...r,details:JSON.parse(r.details)}))};
}
