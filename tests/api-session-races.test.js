import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {configureSiteRoleManagement,setupSiteRoles,isAdmin} from '../server/site-roles.js';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-api-session-race-fictional-'));
 const {db,server}=await createApp({dir,origin:'http://localhost',secure:false});
 const uid='fictional-race-account',cookie='fictional-race-session';
 db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused-fictional-hash');
 db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(cookie),uid,Date.now()+600000);
 const state=emptyWorkspace();state.project.name='Fictional Original Project';
 db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(uid,3,JSON.stringify(state));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 const snapshot=()=>Object.fromEntries(['users','account_profiles','workspaces','files','equipment_items'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 return {db,server,uid,cookie,state,snapshot};
}
const operations=[
 {name:'profile JSON',path:'/api/account/profile',method:'PUT',type:'application/json',bytes:()=>Buffer.from(JSON.stringify({name:'Fictional Forbidden Profile'}))},
 {name:'equipment JSON',path:'/api/equipment',method:'POST',type:'application/json',bytes:()=>Buffer.from(JSON.stringify({name:'Fictional Forbidden Equipment',category:'camera'}))},
 {name:'workspace JSON',path:'/api/workspace',method:'PUT',type:'application/json',bytes:({state})=>{const next=structuredClone(state);next.project.name='Fictional Forbidden Project';return Buffer.from(JSON.stringify({revision:3,state:next}));}},
 {name:'file binary',path:'/api/files',method:'POST',type:'application/pdf',bytes:()=>Buffer.from('%PDF-1.7\nFictional forbidden attachment')}
];
const revocations={
 suspend:({db,uid})=>db.prepare('INSERT INTO account_status VALUES(?,?,NULL)').run(uid,Date.now()+600000),
 deleted:({db,uid})=>db.prepare('INSERT INTO account_status VALUES(?,NULL,?)').run(uid,Date.now()),
 logout:async({server,cookie})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/logout`,{method:'POST',headers:{Origin:'http://localhost',Cookie:'studio_session='+cookie}});assert.equal(response.status,200);await response.arrayBuffer();},
 passwordChange:({db,uid})=>db.prepare('INSERT INTO password_changes VALUES(?)').run(uid),
 expiry:({db,uid})=>db.prepare('UPDATE sessions SET expires=? WHERE user_id=?').run(Date.now()-1,uid),
 removedAccount:({db,uid})=>{db.prepare('DELETE FROM sessions WHERE user_id=?').run(uid);db.prepare('DELETE FROM workspaces WHERE user_id=?').run(uid);db.prepare('DELETE FROM users WHERE id=?').run(uid);}
};

for(const operation of operations)for(const [reason,revoke]of Object.entries(revocations))test(`slow ${operation.name} cannot mutate after ${reason}`,async t=>{
 const context=await fixture(t),bytes=operation.bytes(context);
 let observed;const received=new Promise(resolve=>{observed=req=>{if(req.url===operation.path)resolve();};context.server.on('request',observed);});
 let request;const result=new Promise((resolve,reject)=>{request=http.request({host:'127.0.0.1',port:context.server.address().port,path:operation.path,method:operation.method,headers:{Origin:'http://localhost',Cookie:'studio_session='+context.cookie,'Content-Type':operation.type,'Content-Length':bytes.length}},response=>{let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(body)}));});request.on('error',reject);});
 t.after(()=>request.destroy());
 request.write(bytes.subarray(0,Math.floor(bytes.length/2)));
 await received;context.server.off('request',observed);
 // The handler has authenticated the original cookie and is now waiting for the
 // remaining body. Revoke authority before allowing that same request to resume.
 await new Promise(resolve=>setImmediate(resolve));
 await revoke(context);const before=context.snapshot();
 request.end(bytes.subarray(Math.floor(bytes.length/2)));
 const response=await result;assert.ok([401,403].includes(response.status),JSON.stringify(response));
 assert.deepEqual(context.snapshot(),before,'body completion must not recreate private rows or modify existing data');
});

for(const operation of operations)test(`live session still permits ${operation.name}`,async t=>{
 const context=await fixture(t),before=context.snapshot();
 const response=await fetch(`http://127.0.0.1:${context.server.address().port}${operation.path}`,{method:operation.method,headers:{Origin:'http://localhost',Cookie:'studio_session='+context.cookie,'Content-Type':operation.type},body:operation.bytes(context)});
 assert.ok([200,201].includes(response.status),await response.text());
 assert.notDeepEqual(context.snapshot(),before);
});

for(const action of ['reset-password','suspend','restore'])for(const reason of ['demote','suspend','deleted','logout','passwordChange','expiry'])test(`held administrator ${action} cannot mutate after ${reason}`,async t=>{
 const context=await fixture(t),{db,uid,server,cookie}=context;
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-race-target','fictional-race-target','unchanged-fictional-target-hash');
 // Explicit fixture-only designation lets a role demotion preserve the session,
 // isolating live authority checks from the central account/session body guard.
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-race-highest','fictional-race-highest','unused-fictional-hash');
 db.prepare("INSERT OR REPLACE INTO site_settings VALUES('admin_user_id','fictional-race-highest'),('super_admin_user_id','fictional-race-highest')").run();
 setupSiteRoles(db);configureSiteRoleManagement(db,true);
 db.prepare("INSERT INTO site_role_memberships VALUES(?,'admin',1)").run(uid);
 assert.equal(isAdmin(db,uid),true);
 if(action==='restore')db.prepare('INSERT INTO account_status VALUES(?,?,NULL)').run('fictional-race-target',Date.now()+600000);
 const path='/api/admin/users/fictional-race-target/actions';
 const bytes=Buffer.from(JSON.stringify({action,confirmUsername:'fictional-race-target',reason:'Fictional race safety verification',until:Date.now()+600000}));
 let observed;const received=new Promise(resolve=>{observed=req=>{if(req.url===path)resolve();};server.on('request',observed);});
 let request;const result=new Promise((resolve,reject)=>{request=http.request({host:'127.0.0.1',port:server.address().port,path,method:'POST',headers:{Origin:'http://localhost',Cookie:'studio_session='+cookie,'Content-Type':'application/json','Content-Length':bytes.length}},response=>{let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(body)}));});request.on('error',reject);});
 t.after(()=>request.destroy());request.write(bytes.subarray(0,Math.floor(bytes.length/2)));await received;server.off('request',observed);await new Promise(resolve=>setImmediate(resolve));
 if(reason==='demote')db.prepare("UPDATE site_role_memberships SET role='user',revision=revision+1 WHERE user_id=?").run(uid);else await revocations[reason](context);
 const targetSnapshot=()=>({user:db.prepare('SELECT * FROM users WHERE id=?').get('fictional-race-target'),status:db.prepare('SELECT * FROM account_status WHERE user_id=?').all('fictional-race-target'),passwordChange:db.prepare('SELECT * FROM password_changes WHERE user_id=?').all('fictional-race-target'),audit:db.prepare('SELECT * FROM admin_audit ORDER BY rowid').all()});
 const before=targetSnapshot();request.end(bytes.subarray(Math.floor(bytes.length/2)));const response=await result;
 assert.ok([401,403].includes(response.status),JSON.stringify(response));assert.deepEqual(targetSnapshot(),before);
});
