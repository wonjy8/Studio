import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {hashPassword,digest} from '../server/auth.js';
const password='Fictional!Remember2026';
async function fixture(t,{secure=false}={}){
 const dir=await mkdtemp('/tmp/studio-remember-'),origin=secure?'https://studio.example.invalid':'http://localhost',app=await createApp({dir,origin,secure,enableSiteRoleManagement:true});
 for(const id of ['highest','owner'])app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,await hashPassword(password));
 app.db.prepare("INSERT OR REPLACE INTO site_settings VALUES('super_admin_user_id','highest')").run();app.db.prepare("INSERT OR REPLACE INTO site_settings VALUES('admin_user_id','highest')").run();
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,method='GET',body,cookie,requestOrigin=origin)=>fetch(base+'/api/'+path,{method,headers:{Origin:requestOrigin,...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const login=async(rememberMe,cookie)=>{const before=Date.now(),response=await call('login','POST',{username:'owner',password,...(rememberMe===undefined?{}:{rememberMe})},cookie);return {response,before,after:Date.now(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 return {...app,call,login};
}
test('default login uses a session cookie and 12h server bound; remember uses matching 30d expiry and fresh hashed tokens',async t=>{
 const f=await fixture(t);
 for(const [remember,seconds]of [[undefined,43200],[false,43200],[true,2592000]]){
  const r=await f.login(remember,'studio_session=fixed-attacker-value');assert.equal(r.response.status,200);const header=r.response.headers.get('set-cookie');assert.match(header,/HttpOnly; SameSite=Strict/);assert.notEqual(r.cookie,'studio_session=fixed-attacker-value');
  if(remember)assert.match(header,/Max-Age=2592000/);else assert.doesNotMatch(header,/Max-Age|Expires=/i);
  const raw=r.cookie.split('=')[1],stored=f.db.prepare('SELECT token,expires FROM sessions WHERE token=?').get(digest(raw));assert.ok(stored);assert.notEqual(stored.token,raw);assert.ok(stored.expires>=r.before+seconds*1000&&stored.expires<=r.after+seconds*1000);assert.equal((await f.call('session','GET',undefined,r.cookie)).status,200);
 }
 assert.equal(f.db.prepare('SELECT count(*) n FROM sessions').get().n,3);
 for(const rememberMe of ['true','on',1,null,{}])assert.equal((await f.call('login','POST',{username:'owner',password,rememberMe})).status,400);
 assert.equal((await f.call('login','POST',{username:'owner',password,rememberMe:true},undefined,'https://attacker.invalid')).status,403);
});
test('remembered login remains HTTPS Secure and expires on the server without sliding extension',async t=>{
 const f=await fixture(t,{secure:true}),r=await f.login(true);assert.match(r.response.headers.get('set-cookie'),/; Secure/);const expires=f.db.prepare('SELECT expires FROM sessions WHERE token=?').get(digest(r.cookie.split('=')[1])).expires;
 await f.call('session','GET',undefined,r.cookie);assert.equal(f.db.prepare('SELECT expires FROM sessions WHERE token=?').get(digest(r.cookie.split('=')[1])).expires,expires);
 const original=Date.now;try{Date.now=()=>expires+1;assert.equal((await f.call('session','GET',undefined,r.cookie)).status,401);}finally{Date.now=original;}
});
test('logout revokes current remembered session; password change revokes all remembered and short sessions',async t=>{
 const f=await fixture(t),a=await f.login(true),b=await f.login(false),c=await f.login(true);const out=await f.call('logout','POST',undefined,a.cookie);assert.equal(out.status,200);assert.match(out.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await f.call('session','GET',undefined,a.cookie)).status,401);assert.equal((await f.call('session','GET',undefined,b.cookie)).status,200);
 assert.equal((await f.call('account/password','POST',{currentPassword:password,password:'New!FictionalRemember2026'},b.cookie)).status,200);
 for(const cookie of [b.cookie,c.cookie])assert.equal((await f.call('session','GET',undefined,cookie)).status,401);assert.equal(f.db.prepare('SELECT count(*) n FROM sessions WHERE user_id=?').get('owner').n,0);
});
test('self deletion invalidates remembered sessions without touching another account',async t=>{
 const f=await fixture(t),a=await f.login(true),b=await f.login(true);const preview=await(await f.call('account/deletion-preview','GET',undefined,a.cookie)).json();assert.equal(preview.allowed,true,JSON.stringify(preview));
 const removed=await f.call('account/delete','POST',{currentPassword:password,confirmUsername:preview.target.username,confirmIrreversible:true,scope:preview.scope,expectedSnapshot:preview.expectedSnapshot},a.cookie);assert.equal(removed.status,200);assert.match(removed.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await f.call('session','GET',undefined,b.cookie)).status,401);assert.equal(f.db.prepare('SELECT count(*) n FROM sessions WHERE user_id=?').get('owner').n,0);assert.ok(f.db.prepare('SELECT id FROM users WHERE id=?').get('highest'));
});
