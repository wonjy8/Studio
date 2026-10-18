import {adminProjectFileRoutes} from './admin-project-files.js';
import {accountDeletionRoutes} from './account-deletion.js';
import {configureSiteRoleManagement,siteCapabilities,siteRoleRoutes,claimFirstSiteAdministrator} from './site-roles.js';
import {adminProjectRoutes} from './admin-projects.js';
import {prepareSiteRoleSchema} from './site-role-migration.js';
import {inventoryRoutes} from './inventory.js';
import {equipmentSharingRoutes} from './equipment-sharing.js';
import {isAppPath} from '../src/app/routes.js';
import {prepareAccountSchema} from './account-migration.js';
import {reconcileEquipment} from './equipment.js';
import {validateWorkspace} from '../src/domain/workspace.js';
import {accountRoutes,accountActive,passwordChangeRequired,linkedWorkspace} from './accounts.js';
import {connectionDiagnostics} from './connection-diagnostics.js';
import {oauthService} from './oauth.js';
import {mcpService,toolSchemaVersion} from './mcp.js';
import {writeWorkspace} from './workspace-service.js';
import http from 'node:http';
import {invitationRoutes,isAdmin} from './invitations.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openStore } from './store.js';
import { digest, token, hashPassword, verifyPassword } from './auth.js';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function createApp({dir=process.env.DATA_DIR || './data', origin=process.env.APP_ORIGIN, secure=process.env.COOKIE_SECURE !== 'false',enableSiteRoleManagement=process.env.STUDIO_SITE_ROLE_MANAGEMENT==='enabled'}={}) {
  if (!origin || new URL(origin).origin !== origin || (secure && !origin.startsWith('https://'))) throw Error('APP_ORIGIN must be an exact HTTPS origin.');
  const db = openStore(dir,{siteRoleBootstrap:enableSiteRoleManagement});
  try{await prepareAccountSchema(db,dir);}catch(error){db.close();throw error;}
  configureSiteRoleManagement(db,enableSiteRoleManagement);
  try{if(enableSiteRoleManagement)await prepareSiteRoleSchema(db,dir);}catch(error){db.close();throw error;}
  const handleSiteRoles=siteRoleRoutes(db),handleAdminProjects=adminProjectRoutes(db),handleAdminProjectFiles=adminProjectFileRoutes(db);
  const handleInventory=inventoryRoutes(db);
  const handleEquipmentSharing=equipmentSharingRoutes(db);
  const handleAccounts=accountRoutes(db),handleAccountDeletion=accountDeletionRoutes(db);
  const dummy = await hashPassword(token());
  const diagnostics=connectionDiagnostics(db);
  const handleInvitations=invitationRoutes(db,origin);
  const oauth=oauthService(db,origin),handleMcp=mcpService(db,origin,oauth);
  const attempts = new Map();
  let loginInFlight = 0;
  const server = http.createServer(async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    let diagnosticPath='',diagnosticData,diagnosticDetails={},diagnosticReason='';
    res.once('finish',()=>diagnostics.record(diagnostics.stage(diagnosticPath,diagnosticData),res.statusCode,diagnosticReason,diagnosticDetails));
    const json=(code,body)=>{if(typeof body?.error==='string')diagnosticReason=body.error;if(body?.result?.isError===true)diagnosticReason=body.result._meta?.['mcp/www_authenticate']?'tool_auth_required':'tool_rejected';res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      const url = new URL(req.url,'http://localhost'),path=url.pathname;diagnosticPath=path;
      if (req.method==='GET' && path==='/health') {db.prepare('SELECT 1').get(); return json(200,{ok:true,revision:process.env.STUDIO_REVISION||'development'});}

      const body = async (limit=1024*1024)=>{
        const chunks=[];let size=0;
        for await (const chunk of req) {size+=chunk.length;if(size>limit) {const e=Error();e.status=413;throw e;} chunks.push(chunk);}
        assertLiveMutation();
        return Buffer.concat(chunks);
      };
      let parsedJson,hasParsedJson=false;
      const readJson = async (limit)=>{
        if(hasParsedJson)return parsedJson;
        if (!req.headers['content-type']?.startsWith('application/json')) {const e=Error();e.status=415;throw e;}
        try {const data=JSON.parse(await body(limit));if(path==='/oauth/register')diagnosticDetails=diagnostics.metadata(data);if(path==='/mcp'){diagnosticData={method:typeof data?.method==='string'?data.method:''};diagnosticDetails=diagnostics.toolMetadata(data);}parsedJson=data;hasParsedJson=true;return data;} catch(e) {e.status ||=400;throw e;}
      };
      const cookie = req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('studio_session='))?.slice(15);
      let session = cookie && db.prepare('SELECT user_id,token FROM sessions WHERE token=? AND expires>?').get(digest(cookie),Date.now());
      if(session&&!accountActive(db,session.user_id))session=undefined;
      // A request may wait for its body while another request revokes authority.
      // Cover JSON and binary API bodies; role/ownership checks stay in each
      // mutation's transaction, after this exact-session/account check.
      function assertLiveMutation(){
        if(!session||!path.startsWith('/api/')||['GET','HEAD'].includes(req.method))return;
        if(!db.prepare('SELECT id FROM users WHERE id=?').get(session.user_id)||!accountActive(db,session.user_id)||!db.prepare('SELECT token FROM sessions WHERE token=? AND user_id=? AND expires>?').get(session.token,session.user_id,Date.now()))throw Object.assign(Error('Session changed. Sign in again'),{status:401});
        if(path!=='/api/account/password'&&passwordChangeRequired(db,session.user_id))throw Object.assign(Error('PASSWORD_CHANGE_REQUIRED'),{status:403});
      }
      const setCookie=(value,age)=>res.setHeader('Set-Cookie',`studio_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`);
      if(session&&passwordChangeRequired(db,session.user_id)&&!['/api/session','/api/logout','/api/account/password'].includes(path)&&path.startsWith('/api/'))return json(403,{error:'PASSWORD_CHANGE_REQUIRED'});
      if(path==='/api/connections/diagnostics'&&req.method==='GET'){if(!session)return json(401,{error:'Login required'});if(!isAdmin(db,session.user_id))return json(403,{error:'Administrator required'});return json(200,{version:'connection-diagnostics-1',toolSchemaVersion,events:diagnostics.list()});}
      if(path==='/mcp'){await handleMcp({req,res,json,readJson});return;}
      if(await oauth.routes({path,url,req,res,json,body,readJson,session}))return;
      if (!['GET','HEAD'].includes(req.method) && req.headers.origin !== origin) return json(403,{error:'Origin rejected'});
      if(await handleSiteRoles({path,url,req,session,json,readJson}))return;
      if(await handleAdminProjectFiles({path,url,req,res,session,json,readJson}))return;
      if(await handleAdminProjects({path,url,req,session,json,readJson}))return;
      if(await handleInvitations({path,req,session,json,readJson}))return;
      if(await handleEquipmentSharing({path,url,req,session,json,readJson}))return;
      if(await handleInventory({path,url,req,session,json,readJson}))return;
      if(await handleAccountDeletion({path,url,req,session,json,readJson,clearSessionCookie:()=>setCookie('',0)}))return;
      if(await handleAccounts({path,url,req,session,json,readJson}))return;
      if (path==='/api/login' && req.method==='POST') {
        const data = await readJson();
        if (typeof data.username!=='string'||data.username.length>64||typeof data.password!=='string'||data.password.length>256) return json(400,{error:'Invalid input'});
        const now=Date.now();
        for(const [key,v] of attempts) if(v.until<now) attempts.delete(key);
        // Global plus account budgets: do not trust spoofable proxy/IP headers.
        const keys=['*',data.username.toLowerCase()];
        if(loginInFlight>=4 || keys.some(k=>(attempts.get(k)?.count||0)>=(k==='*'?100:10))) return json(429,{error:'Try again later'});
        keys.forEach(k=>attempts.set(k,{count:(attempts.get(k)?.count||0)+1,until:attempts.get(k)?.until||now+900000}));
        const user=db.prepare('SELECT * FROM users WHERE username=?').get(data.username);
        loginInFlight++;
        let valid;try {valid=await verifyPassword(data.password,user?.password||dummy);} finally {loginInFlight--;}
        if(!valid||!user||!accountActive(db,user.id)||db.prepare('SELECT password FROM users WHERE id=?').get(user.id)?.password!==user.password) return json(401,{error:'Login failed'});
        const raw=token();db.exec('BEGIN IMMEDIATE');
        try{
          // Password verification is asynchronous: recheck the account under the same lock as first-login claiming.
          if(!accountActive(db,user.id)||db.prepare('SELECT password FROM users WHERE id=?').get(user.id)?.password!==user.password){db.exec('ROLLBACK');return json(401,{error:'Login failed'});}
          db.prepare("INSERT OR IGNORE INTO site_settings VALUES('admin_user_id',?)").run(user.id);
          claimFirstSiteAdministrator(db,user.id);
          db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
          db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),user.id,now+43200000);
          db.exec('COMMIT');
        }catch(error){db.exec('ROLLBACK');throw error;}
        attempts.delete(keys[1]);
        setCookie(raw,43200);return json(200,{ok:true,passwordChangeRequired:passwordChangeRequired(db,user.id)});
      }
      if(path.startsWith('/api/')) {
        if(!session) return json(401,{error:'Login required'});
        const uid=session.user_id;
        if(path==='/api/session'&&req.method==='GET') return json(200,{ok:true,...siteCapabilities(db,uid),passwordChangeRequired:passwordChangeRequired(db,uid),account:db.prepare("SELECT u.id,u.username,COALESCE(p.name,'') name FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id WHERE u.id=?").get(uid)});
        if(path==='/api/logout'&&req.method==='POST') {db.prepare('DELETE FROM sessions WHERE token=?').run(digest(cookie));setCookie('',0);return json(200,{ok:true});}
        if(path==='/api/workspace'&&req.method==='GET') {
          const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(uid);
          return json(200,row?{revision:row.revision,state:reconcileEquipment(db,uid,linkedWorkspace(db,uid,JSON.parse(row.body)))}:{revision:0,state:null});
        }
        if(path==='/api/workspace'&&req.method==='PUT') {
          const data=await readJson();
          if(!validateWorkspace(data.state))return json(400,{error:'Invalid workspace'});
          try{return json(200,writeWorkspace(db,uid,linkedWorkspace(db,uid,data.state),data.revision));}catch(e){return json(e.status||500,{error:e.message});}
        }
        if(path==='/api/files'&&req.method==='POST') {
          const type=req.headers['content-type'];
          if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(type)) return json(415,{error:'PDF, PNG, JPEG or WebP required'});
          const bytes=await body(10*1024*1024);
          const signature=type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':type==='image/png'?bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a':type==='image/jpeg'?bytes.subarray(0,3).toString('hex')==='ffd8ff':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
          if(!signature) return json(400,{error:'Invalid file'});
          const usage=db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS size FROM files WHERE user_id=?').get(uid).size;
          if(usage+bytes.length>250*1024*1024) return json(413,{error:'Storage quota reached'});
          const id=randomUUID(), name=decodeURIComponent(req.headers['x-file-name']||'file').slice(0,200);
          db.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run(id,uid,name,type,bytes);
          return json(201,{id,url:`/api/files/${id}`});
        }
        const match=path.match(/^\/api\/files\/([a-f0-9-]{36})$/);
        if(match&&req.method==='GET') {
          const file=db.prepare('SELECT * FROM files WHERE id=? AND user_id=?').get(match[1],uid);
          if(!file) return json(404,{error:'Not found'});
          res.setHeader('Content-Type',file.type);
          res.setHeader('Content-Disposition',`${new URL(req.url,'http://localhost').searchParams.has('download')?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`);
          res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
          return res.end(file.bytes);
        }
        return json(404,{error:'Not found'});
      }
      // Explicit static allowlist prevents serving runtime DBs, server code or repository files.
      if(req.method!=='GET'&&req.method!=='HEAD') return json(405,{error:'Method not allowed'});
      if(!(/^\/src\/[a-zA-Z0-9_/-]+\.(js|css)$/.test(path)||path==='/'||path==='/index.html'||path==='/src/rotation-cursor.svg'||isAppPath(path))) return json(404,{error:'Not found'});
      const file=path==='/'||isAppPath(path)?'index.html':path.slice(1);
      const bytes=await readFile(root+file);
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file==='src/rotation-cursor.svg'?'image/svg+xml':'text/html');
      res.end(req.method==='HEAD'?undefined:bytes);
    } catch(e) {if(!res.headersSent) json(e.status|| (e.code==='ENOENT'?404:500),{error:e.status===413?'Request too large':(e.status&&pathForError(req.url)?e.message:'Request failed')});else res.end();}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  server.on('close',()=>db.close());
  return {server,db};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {server}=await createApp();
  server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Studio listening'));
}

function pathForError(url){return url.startsWith('/oauth/')||url.startsWith('/api/connections');}
