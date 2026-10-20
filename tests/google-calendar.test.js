import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest,token} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects} from '../src/domain/projects.js';
import {projectCalendarEvents,calendarRange} from '../server/google-calendar-model.js';
import {googleCalendarScope,googleCalendarListScope} from '../server/google-calendar.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function fixture(t){
 const dir=await mkdtemp('/tmp/studio-calendar-test-'),events=new Map(),calls=[],flags={};
 const fetcher=async(input,options={})=>{const url=new URL(input),method=options.method||'GET';calls.push({path:url.pathname,query:url.search,method});
  if(url.hostname==='oauth2.googleapis.com'){const form=new URLSearchParams(options.body);if(form.get('grant_type')==='refresh_token'&&flags.expired)return json({error:'invalid_grant'},400);const user=(form.get('code')||form.get('refresh_token')||'alpha').includes('beta')?'beta':'alpha';return json({access_token:'fictional-access-'+user,refresh_token:'fictional-refresh-'+user,expires_in:3600,scope:flags.noScope?'openid email':googleCalendarScope+' '+googleCalendarListScope});}
  const user=String(options.headers?.Authorization).includes('beta')?'beta':'alpha';
  if(url.hostname==='openidconnect.googleapis.com')return json({sub:'fictional-google-'+user,email:user+'@example.invalid',email_verified:true});
  if(url.pathname.endsWith('/calendarList')&&flags.rateLimit)return json({error:'quota'},429);
  if(url.pathname.endsWith('/calendarList'))return json({items:[{id:user+'-primary',summary:'Private',primary:true,accessRole:'owner',timeZone:'Asia/Seoul'},{id:user+'-church',summary:'Church',accessRole:flags.revoked?'reader':'writer',timeZone:'Asia/Seoul'},{id:user+'-work',summary:'Work',accessRole:'owner',timeZone:'America/New_York'},{id:user+'-read',summary:'Read only',accessRole:'reader'}]});
  const match=url.pathname.match(/\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);assert.ok(match,url.href);const calendar=decodeURIComponent(match[1]),id=match[2],key=user+':'+calendar+':'+id;
  if(method==='GET'&&!id)return json({timeZone:'Asia/Seoul',items:url.searchParams.get('pageToken')?[{id:'repeat',summary:user+' private recurring',start:{dateTime:'2026-10-20T10:00:00+09:00'},end:{dateTime:'2026-10-20T11:00:00+09:00'},recurringEventId:'series'}]:[{id:'personal',summary:user+' private all-day',start:{date:'2026-10-20'},end:{date:'2026-10-21'}},{id:'cancelled',status:'cancelled',start:{date:'2026-10-20'}}],...(url.searchParams.has('pageToken')?{}:{nextPageToken:'page-two'})});
  if(method==='GET')return events.has(key)?json(events.get(key)):json({error:'not found'},404);
  const body=JSON.parse(options.body);if(method==='POST'){const insertKey=user+':'+calendar+':'+body.id;if(events.has(insertKey))return json({error:'already exists'},409);events.set(insertKey,{...body,etag:'fictional-etag'});if(flags.loseInsert){flags.loseInsert=false;throw Error('Fictional response loss');}return json(events.get(insertKey));}
  assert.equal(method,'PATCH');if(!events.has(key))return json({error:'not found'},404);events.set(key,{...events.get(key),...body});return json(events.get(key));
 };
 const app=await createApp({dir,origin:'http://localhost',secure:false,google:{clientId:'fictional-client',clientSecret:'fictional-secret',fetcher,pollMs:0}}),cookies={};
 for(const uid of ['alpha','beta']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'fictional-hash');const raw=token();app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),uid,Date.now()+3600000);cookies[uid]='studio_session='+raw;const state=prepareProjects(emptyWorkspace());state.project.id=uid+'-project';state.project.name='Fictional '+uid;state.contents=[{id:'shoot-future',name:'Upcoming',date:'2026-10-20',time:'10:00–11:30',location:'Set A',status:'check',script:false},{id:'shoot-past',name:'Past',date:'2025-01-01',time:'',location:'',status:'check',script:false}];app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(uid,1,JSON.stringify(state));}
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,uid='alpha',method='GET',body)=>fetch(base+path,{method,redirect:'manual',headers:{...(uid?{Cookie:cookies[uid]}:{}),...(method==='GET'?{}:{Origin:'http://localhost','Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const start=async(uid='alpha')=>{const r=await call('/api/google/calendar/connect',uid,'POST',{timeZone:'Asia/Seoul'});assert.equal(r.status,200);return new URL((await r.json()).url);};
 const finish=async(url,uid='alpha')=>call('/oauth/google/calendar/callback?'+new URLSearchParams({state:url.searchParams.get('state'),code:'fictional-code-'+uid}),uid);
 const connect=async(uid='alpha')=>{const url=await start(uid);assert.equal((await finish(url,uid)).status,302);return url;};
 const configure=async(calendarId='alpha-church',uid='alpha')=>{const r=await call('/api/google/calendar/projects/'+uid+'-project',uid,'POST',{enabled:true,calendarId,fromDate:'2026-01-01'});assert.equal(r.status,200);};
 t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});return {...app,call,start,finish,connect,configure,events,calls,flags};
}
test('Calendar dates preserve local timezone, all-day exclusive ends, overnight and DST ranges',()=>{
 const p=prepareProjects(emptyWorkspace());p.project.name='Fictional';p.contents=[{id:'all',name:'All day',date:'2026-10-20',time:''},{id:'night',name:'Night',date:'2026-10-20',time:'23:30–00:30'}];const {events}=projectCalendarEvents(p,{uid:'a',subject:'s',timeZone:'Asia/Seoul'});assert.deepEqual(events[0].body.start,{date:'2026-10-20'});assert.deepEqual(events[0].body.end,{date:'2026-10-21'});assert.equal(events[1].body.end.dateTime,'2026-10-21T00:30:00');assert.match(events[0].eventId,/^[0-9a-v]{5,1024}$/);
 assert.equal(calendarRange('2026-10-20','2026-10-21','Asia/Seoul').timeMin,'2026-10-19T15:00:00.000Z');const range=calendarRange('2026-03-08','2026-03-09','America/New_York');assert.equal(Date.parse(range.timeMax)-Date.parse(range.timeMin),23*3600000);
});
test('Calendar OAuth is explicit, session-bound, separate from Sheets, encrypted and replay safe',async t=>{
 const f=await fixture(t);assert.equal((await f.call('/api/google/calendar/status',null)).status,401);const url=await f.start();assert.ok(url.searchParams.get('scope').includes(googleCalendarScope));assert.ok(url.searchParams.get('scope').includes(googleCalendarListScope));assert.equal(url.searchParams.get('include_granted_scopes'),'false');assert.equal((await f.finish(url,'beta')).status,403);const completed=await f.finish(url);assert.equal(completed.status,302);assert.equal(completed.headers.get('location'),'/settings/connections?calendar=connected');assert.equal((await f.finish(url)).status,403);
 const row=f.db.prepare('SELECT credentials FROM google_calendar_accounts WHERE user_id=?').get('alpha');assert.equal(row.credentials.includes('fictional-access'),false);assert.equal(f.db.prepare('SELECT count(*) n FROM google_accounts').get().n,0);assert.equal((await (await f.call('/api/google/calendar/status','beta')).json()).connected,false);
});
test('Project selection checks calendar ACLs and date scope; export is idempotent and target changes never duplicate existing events',async t=>{
 const f=await fixture(t);await f.connect();assert.equal((await f.call('/api/google/calendar/projects/alpha-project','alpha','POST',{enabled:true,calendarId:'alpha-read',fromDate:'2026-01-01'})).status,403);assert.equal((await f.call('/api/google/calendar/projects/beta-project','alpha','POST',{enabled:true,calendarId:'alpha-church',fromDate:'2026-01-01'})).status,403);
 await f.configure();assert.equal(f.events.size,0,'saving configuration makes no remote writes');await f.calendar.sync('alpha',true);assert.equal(f.events.size,1,'past dates are excluded');const original=[...f.events.keys()][0];assert.ok(original.includes('alpha-church'));await f.calendar.sync('alpha',true);assert.equal(f.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/events')).length,1);
 await f.configure('alpha-work');const state=JSON.parse(f.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get('alpha').body);state.contents[0].name='Changed source';state.contents.push({...state.contents[0],id:'new-shoot',name:'New source'});f.db.prepare('UPDATE workspaces SET body=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(state),'alpha');await f.calendar.sync('alpha',true);assert.equal(f.events.size,2);assert.ok(f.events.get(original).summary.includes('Changed source'));assert.ok([...f.events.keys()].some(key=>key.includes('alpha-work')));assert.equal(f.calls.some(c=>c.method==='DELETE'),false);
});
test('Response-loss retries reuse stable IDs; private recurring events remain home-only; disconnect and refresh expiry stop access',async t=>{
 const f=await fixture(t);await f.connect();await f.configure();f.flags.loseInsert=true;await assert.rejects(f.calendar.sync('alpha',true));await f.calendar.sync('alpha',true);assert.equal(f.events.size,1);assert.equal(f.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/events')).length,1);
 const r=await f.call('/api/google/calendar/events?start=2026-10-20&end=2026-10-22&calendarId=alpha-primary');assert.equal(r.status,200);const data=await r.json();assert.equal(data.events.length,2);assert.equal(data.events[1].recurring,true);assert.ok(f.calls.some(c=>c.query.includes('singleEvents=true')));assert.equal(f.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get('alpha').body.includes('private recurring'),false);
 await f.connect('beta');assert.equal((await f.call('/api/google/calendar/events?start=2026-10-20&end=2026-10-22&calendarId=alpha-primary','beta')).status,403);
 const row=f.db.prepare('SELECT * FROM google_calendar_accounts WHERE user_id=?').get('alpha'),credentials=f.googleSheets.credentialCodec.unseal(row.credentials);credentials.expires=0;f.db.prepare('UPDATE google_calendar_accounts SET credentials=? WHERE user_id=?').run(f.googleSheets.credentialCodec.seal(credentials),'alpha');f.flags.expired=true;assert.equal((await f.call('/api/google/calendar/calendars')).status,401);
 await f.call('/api/google/calendar/disconnect','alpha','POST',{});assert.equal((await f.call('/api/google/calendar/events?start=2026-10-20&end=2026-10-22')).status,409);assert.equal(f.events.size,1,'disconnect never deletes Google events');
});
test('Calendar rejects missing consent scope, detects lost calendar write permission, and never revives deleted events',async t=>{
 const f=await fixture(t);f.flags.noScope=true;const start=await f.start();assert.equal((await f.finish(start)).status,403);assert.equal(f.db.prepare('SELECT count(*) n FROM google_calendar_accounts').get().n,0);f.flags.noScope=false;await f.connect();await f.configure();await f.calendar.sync('alpha',true);f.flags.revoked=true;await assert.rejects(f.calendar.sync('alpha',true),/쓰기 권한/);f.flags.revoked=false;
 const row=f.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get('alpha'),state=JSON.parse(row.body);state.contents[0].name='Changed after external deletion';f.db.prepare('UPDATE workspaces SET body=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(state),'alpha');f.events.clear();await assert.rejects(f.calendar.sync('alpha',true),/자동 복원하지/);assert.equal(f.events.size,0);
});

test('Calendar quota failures back off and a manual retry recovers without duplicate exports',async t=>{
 const f=await fixture(t);await f.connect();await f.configure();f.flags.rateLimit=true;await assert.rejects(f.calendar.sync('alpha',true),/한도/);const count=f.calls.length;assert.equal((await f.calendar.sync('alpha')).deferred,true);assert.equal(f.calls.length,count);f.flags.rateLimit=false;await f.calendar.sync('alpha',true);assert.equal(f.events.size,1);assert.equal(f.db.prepare('SELECT error FROM google_calendar_accounts WHERE user_id=?').get('alpha').error,'');
});
