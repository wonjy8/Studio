import {documentFileRoutes} from './document-files.js';
import {workspaceHomeEventRoutes} from './workspace-home-events.js';
import {schoolRoutes} from './school.js';
import {googleReadService} from './google-read.js';
import {publicCalendarDiagnostic} from './google-calendar-errors.js';
import {indexNewMaterialUpload} from './material-index.js';
import {googleUnifiedService} from './google-unified.js';
import {googleOAuthAttempts} from './google-oauth-attempts.js';
import {googleOAuthReturn} from './google-oauth-return.js';
import {googleTasksService} from './google-tasks.js';
import {googleCalendarService} from './google-calendar.js';
import {scriptureRoutes} from './scripture.js';
import {documentLibraryRoutes} from './document-library.js';
import {equipmentCatalogRoutes} from './equipment-catalog.js';
import {syncRepresentatives} from './project-representative.js';
import {referenceLibraryRoutes,reconcileReferences} from './reference-library.js';
import {referenceBoardRoutes} from './reference-boards.js';
import {materialLibraryRoutes,registerMaterialFile,registerNewProjectDocuments} from './material-library.js';
import {contactRoutes} from './contacts.js';
import {rentalVendorRoutes} from './rental-vendors.js';
import {googleSheetsService} from './google-sheets.js';
import {adminProjectFileRoutes} from './admin-project-files.js';
import {accountDeletionRoutes} from './account-deletion.js';
import {configureSiteRoleManagement,siteCapabilities,siteRoleRoutes,claimFirstSiteAdministrator} from './site-roles.js';
import {adminProjectRoutes} from './admin-projects.js';
import {prepareSiteRoleSchema} from './site-role-migration.js';
import {inventoryRoutes,orgCanRead} from './inventory.js';
import {equipmentSharingRoutes,equipmentProjectScope} from './equipment-sharing.js';
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
export async function createApp({dir=process.env.DATA_DIR || './data', origin=process.env.APP_ORIGIN, secure=process.env.COOKIE_SECURE !== 'false',contentWorkspaces=[],google={},googleCalendar={},googleTasks={},scripture={},enableSiteRoleManagement=process.env.STUDIO_SITE_ROLE_MANAGEMENT==='enabled'}={}) {
  if (!origin || new URL(origin).origin !== origin || (secure && !origin.startsWith('https://'))) throw Error('APP_ORIGIN must be an exact HTTPS origin.');
  const db = openStore(dir,{siteRoleBootstrap:enableSiteRoleManagement});
  try{await prepareAccountSchema(db,dir);}catch(error){db.close();throw error;}
  configureSiteRoleManagement(db,enableSiteRoleManagement);
  try{if(enableSiteRoleManagement)await prepareSiteRoleSchema(db,dir);}catch(error){db.close();throw error;}
  const handleSiteRoles=siteRoleRoutes(db),handleAdminProjects=adminProjectRoutes(db),handleAdminProjectFiles=adminProjectFileRoutes(db);
  const handleSchool=schoolRoutes(db);let handleWorkspaceHomeEvents;
  const handleScripture=scriptureRoutes(db,scripture);
  const handleDocumentLibrary=documentLibraryRoutes(db),handleDocumentFiles=documentFileRoutes(db);
  const handleEquipmentCatalog=equipmentCatalogRoutes(db);
  const handleInventory=inventoryRoutes(db),handleRentalVendors=rentalVendorRoutes(db),handleContacts=contactRoutes(db,{orgCanRead,equipmentProjectScope}),handleReferenceLibrary=referenceLibraryRoutes(db),handleMaterials=materialLibraryRoutes(db);
  const handleReferenceBoards=referenceBoardRoutes(db);
  syncRepresentatives(db);
  const googleAttempts=googleOAuthAttempts();let googleSheets;try{googleSheets=await googleSheetsService(db,{dir,origin,...google,oauthAttempts:googleAttempts});}catch(error){db.close();throw error;}
  const calendar=googleCalendarService(db,{origin,...google,...googleCalendar,codec:googleSheets.credentialCodec,oauthAttempts:googleAttempts});
  handleWorkspaceHomeEvents=workspaceHomeEventRoutes(db,{prepareTarget:calendar.prepareHomeTarget});
  const tasksGoogle=googleTasksService(db,{origin,...google,...googleTasks,codec:googleSheets.credentialCodec,oauthAttempts:googleAttempts});
  const handleEquipmentSharing=equipmentSharingRoutes(db);
  const handleAccounts=accountRoutes(db),handleAccountDeletion=accountDeletionRoutes(db);
  const dummy = await hashPassword(token());
  const diagnostics=connectionDiagnostics(db);
  const googleUnified=googleUnifiedService(db,{origin,...google,codec:googleSheets.credentialCodec,attempts:googleAttempts});
  const googleRead=googleReadService(db,{origin,...google,codec:googleSheets.credentialCodec,attempts:googleAttempts});
  const handleInvitations=invitationRoutes(db,origin);
  const oauth=oauthService(db,origin),handleMcp=mcpService(db,origin,oauth,{workspaces:contentWorkspaces});
  const attempts = new Map();
  const googleReturn=googleOAuthReturn(db,{secure});
  let loginInFlight = 0;
  const server = http.createServer(async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    let session;let diagnosticPath='',diagnosticData,diagnosticDetails={},diagnosticReason='';
    res.once('finish',()=>diagnostics.record(diagnostics.stage(diagnosticPath,diagnosticData),res.statusCode,diagnosticReason,diagnosticDetails));
    const json=(code,body)=>{if(typeof body?.error==='string')diagnosticReason=body.error;if(body?.result?.isError===true)diagnosticReason=body.result._meta?.['mcp/www_authenticate']?'tool_auth_required':'tool_rejected';if(code===200)googleReturn.start(diagnosticPath,body,session,res);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
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
      session = cookie && db.prepare('SELECT user_id,token FROM sessions WHERE token=? AND expires>?').get(digest(cookie),Date.now());
      const returnedSession=googleReturn.recover(path,url,req,res);if(!session&&returnedSession)session=returnedSession;
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
      if(path==='/api/connections/diagnostics'&&req.method==='GET'){if(!session)return json(401,{error:'Login required'});if(!isAdmin(db,session.user_id))return json(403,{error:'Administrator required'});return json(200,{version:'connection-diagnostics-1',toolSchemaVersion,serverRevision:/^[a-f0-9]{7,40}$/.test(process.env.STUDIO_REVISION||'')?process.env.STUDIO_REVISION:'development',issuerIdentification:true,events:diagnostics.list()});}
      if(path==='/oauth/google/tasks/callback'&&await tasksGoogle.routes({path,url,req,res,session,json,readJson}))return;
      if(path==='/oauth/google/calendar/callback'&&await calendar.routes({path,url,req,res,session,json,readJson}))return;
      if(path==='/oauth/google/callback'&&await googleRead.routes({path,url,req,res,session,json,readJson}))return;
      if(path==='/oauth/google/callback'&&await googleUnified.routes({path,url,req,res,session,json,readJson}))return;
      if(path==='/oauth/google/callback'&&await googleSheets.routes({path,url,req,res,session,json,readJson}))return;
      if(path==='/mcp'){await handleMcp({req,res,json,readJson});return;}
      if(await oauth.routes({path,url,req,res,json,body,readJson,session}))return;
      if (!['GET','HEAD'].includes(req.method) && req.headers.origin !== origin) return json(403,{error:'Origin rejected'});
      if(await handleSiteRoles({path,url,req,session,json,readJson}))return;
      if(await handleAdminProjectFiles({path,url,req,res,session,json,readJson}))return;
      if(await handleAdminProjects({path,url,req,session,json,readJson}))return;
      if(await handleInvitations({path,req,session,json,readJson}))return;
      if(await handleEquipmentSharing({path,url,req,session,json,readJson}))return;
      if(await handleWorkspaceHomeEvents({path,req,session,json,readJson,assertLiveMutation})){if(!['GET','HEAD'].includes(req.method)&&res.statusCode<400)calendar.kick(session.user_id);return;}
      if(await handleSchool({path,req,session,json,readJson})){if(req.method!=='GET'&&res.statusCode>=200&&res.statusCode<300)calendar.kick(session.user_id);return;}
      if(await handleScripture({path,url,req,session,json,readJson,readBody:body,assertLiveMutation}))return;
      if(await handleDocumentLibrary({path,req,session,json,readJson}))return;
      if(await handleReferenceLibrary({path,req,session,json,readJson}))return;
      if(await handleReferenceBoards({path,req,session,json,readJson}))return;
      if(await handleMaterials({path,req,res,session,json,readJson}))return;
      if(await handleContacts({path,req,session,json,readJson}))return;
      if(await handleRentalVendors({path,req,session,json,readJson}))return;
      if(await googleRead.routes({path,url,req,res,session,json,readJson}))return;
      if(await googleUnified.routes({path,url,req,res,session,json,readJson}))return;
      if(await tasksGoogle.routes({path,url,req,res,session,json,readJson}))return;
      if(await calendar.routes({path,url,req,res,session,json,readJson}))return;
      if(await googleSheets.routes({path,url,req,res,session,json,readJson}))return;
      if(await handleEquipmentCatalog({path,url,req,res,session,json,readJson}))return;
      if(await handleInventory({path,url,req,session,json,readJson})){if(!['GET','HEAD'].includes(req.method)&&res.statusCode<400)googleSheets.kick();return;}
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
          claimFirstSiteAdministrator(db,user.id);syncRepresentatives(db);
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
        if(path==='/api/session'&&req.method==='GET') return json(200,{ok:true,appVersion:process.env.STUDIO_REVISION||'development',...siteCapabilities(db,uid),passwordChangeRequired:passwordChangeRequired(db,uid),account:db.prepare("SELECT u.id,u.username,COALESCE(p.name,'') name FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id WHERE u.id=?").get(uid)});
        if(path==='/api/logout'&&req.method==='POST') {db.prepare('DELETE FROM sessions WHERE token=?').run(digest(cookie));setCookie('',0);return json(200,{ok:true});}
        if(path==='/api/workspace'&&req.method==='GET') {
          const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(uid);
          return json(200,row?{revision:row.revision,state:reconcileEquipment(db,uid,linkedWorkspace(db,uid,JSON.parse(row.body)))}:{revision:0,state:null});
        }
        if(path==='/api/workspace'&&req.method==='PUT') {
          const data=await readJson();
          if(!validateWorkspace(data.state))return json(400,{error:'Invalid workspace'});
          try{const previous=db.prepare('SELECT body FROM workspaces WHERE user_id=?').get(uid),saved=writeWorkspace(db,uid,linkedWorkspace(db,uid,data.state),data.revision);registerNewProjectDocuments(db,uid,saved.state,previous?JSON.parse(previous.body):null);calendar.kick(uid);tasksGoogle.kick(uid);return json(200,saved);}catch(e){return json(e.status||500,{error:e.message});}
        }
        if(await handleDocumentFiles({path,req,res,session,json,body,readJson}))return;
        if((path==='/api/files'||path==='/api/school/files')&&req.method==='POST') {
          const schoolPrivate=path==='/api/school/files';
          const type=req.headers['content-type'];
          const supported=['application/pdf','image/png','image/jpeg','image/webp','video/mp4','video/webm','video/quicktime','text/plain','text/csv','application/json','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','audio/mpeg','audio/wav','audio/ogg'];if(!supported.includes(type)) return json(415,{error:'지원하지 않는 파일 형식입니다.'});
          const bytes=await body(50*1024*1024);
          const signature=type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':type==='image/png'?bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a':type==='image/jpeg'?bytes.subarray(0,3).toString('hex')==='ffd8ff':type==='video/mp4'||type==='video/quicktime'?bytes.subarray(4,8).toString()==='ftyp':type==='video/webm'?bytes.subarray(0,4).toString('hex')==='1a45dfa3':type==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':['application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(type)?bytes.subarray(0,4).toString('hex')==='504b0304':type==='audio/wav'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE':type==='audio/ogg'?bytes.subarray(0,4).toString()==='OggS':type==='audio/mpeg'?bytes.subarray(0,3).toString()==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0):(()=>{try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return !bytes.includes(0);}catch{return false;}})();
          if(!signature) return json(400,{error:'Invalid file'});
          const usage=db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS size FROM files WHERE user_id=?').get(uid).size+db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS size FROM school_files WHERE user_id=?').get(uid).size+db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS size FROM document_files WHERE user_id=?').get(uid).size;
          if(usage+bytes.length>250*1024*1024) return json(413,{error:'Storage quota reached'});
          const id=randomUUID(), name=decodeURIComponent(req.headers['x-file-name']||'file').slice(0,200);
          db.exec('BEGIN IMMEDIATE');try{if(schoolPrivate)db.prepare('INSERT INTO school_files VALUES(?,?,?,?,?)').run(id,uid,name,type,bytes);else{db.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run(id,uid,name,type,bytes);registerMaterialFile(db,uid,{id,name,type});indexNewMaterialUpload(db,uid,{id,name,type,bytes,colors:req.headers['x-material-colors']});}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
          return json(201,{id,url:`/api/${schoolPrivate?'school/':''}files/${id}`});
        }
        const schoolFile=path.match(/^\/api\/school\/files\/([a-f0-9-]{36})$/);
        if(schoolFile&&req.method==='GET'){const file=db.prepare('SELECT * FROM school_files WHERE id=? AND user_id=?').get(schoolFile[1],uid);res.setHeader('Cache-Control','private, no-store');if(!file)return json(404,{error:'Not found'});res.setHeader('Content-Type',file.type);res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`);res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");return res.end(file.bytes);}
        const match=path.match(/^\/api\/files\/([a-f0-9-]{36})$/);
        if(match&&req.method==='GET') {
          let file=db.prepare('SELECT * FROM files WHERE id=? AND user_id=?').get(match[1],uid);
          if(!file){for(const link of db.prepare('SELECT owner_id,project_id FROM project_accounts WHERE user_id=?').all(uid)){const row=db.prepare('SELECT body FROM workspaces WHERE user_id=?').get(link.owner_id);if(!row)continue;const state=reconcileReferences(db,link.owner_id,JSON.parse(row.body)),project=[state,...(state.projects||[])].find(p=>(p.project.id||'project-main')===link.project_id);if(project?.refs.some(ref=>ref.libraryId&&(ref.images.includes('/api/files/'+match[1])||(ref.files||[]).includes(match[1])))){file=db.prepare('SELECT * FROM files WHERE id=? AND user_id=?').get(match[1],link.owner_id);if(file)break;}}}
          res.setHeader('Cache-Control','private, no-store');
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
    } catch(e) {if(['/oauth/token','/oauth/revoke'].includes(diagnosticPath)&&e.oauthClientDiagnostic)diagnosticDetails=diagnostics.clientAuthentication(e.oauthClientDiagnostic);if(!res.headersSent&&req.headers.accept?.includes('text/html')&&/^\/oauth\/google\/(?:calendar\/|tasks\/)?callback(?:\?|$)/.test(req.url)){const service=req.url.startsWith('/oauth/google/tasks/')?'Google Tasks':req.url.startsWith('/oauth/google/calendar/')?'Google Calendar':'Google';const status=e.status||500;res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+service+' 연결 확인</title><body><main><h1>'+service+' 연결을 완료하지 못했습니다</h1><p>연결 요청이 만료되었거나 로그인·동의 확인에 실패했습니다. 기존 연결은 유지됩니다.</p><p><a href="/settings/connections">연결 설정으로 돌아가기</a></p></main></body></html>');}else if(!res.headersSent) json(e.status|| (e.code==='ENOENT'?404:500),{error:e.status===413?'Request too large':(e.status&&pathForError(req.url)?e.message:'Request failed'),...(publicCalendarDiagnostic(e)?{calendarDiagnostic:publicCalendarDiagnostic(e)}:{})});else res.end();}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  server.on('close',()=>{handleMcp.close();googleRead.close();googleUnified.close();googleAttempts.close();tasksGoogle.close();calendar.close();googleSheets.close();db.close();});
  return {server,db,googleSheets,calendar,tasksGoogle};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {server}=await createApp();
  server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Studio listening'));
}

function pathForError(url){return url.startsWith('/oauth/')||url.startsWith('/api/connections')||url.startsWith('/api/google')||url.startsWith('/api/contacts')||url.startsWith('/api/admin/contacts')||url.startsWith('/api/reference-library')||url.startsWith('/api/reference-boards')||url.startsWith('/api/material-equipment')||/^\/api\/projects\/[^/]+\/(contact-selection|reference-library)(?:[/?]|$)/.test(url);}
