import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
test('login diagnosis baseline separates multi-client sessions, exact identity, origin rejection and shared account throttling',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-login-diagnosis-')),origin='http://localhost';const {server,db}=await createApp({dir,origin,secure:false});const password='Fictional!Diagnosis2026';db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-user','FictionalUser',await hashPassword(password));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;
 const login=(username,secret=password,requestOrigin=origin)=>fetch(base+'/api/login',{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify({username,password:secret})});const session=cookie=>fetch(base+'/api/session',{headers:{Cookie:cookie}});
 const a=await login('FictionalUser');assert.equal(a.status,200);const cookieA=a.headers.get('set-cookie').split(';')[0];const b=await login('FictionalUser');assert.equal(b.status,200);const cookieB=b.headers.get('set-cookie').split(';')[0];assert.notEqual(cookieA,cookieB);assert.equal((await session(cookieA)).status,200);assert.equal((await session(cookieB)).status,200);assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n,2);
 const wrongOrigin=await login('FictionalUser',password,'http://wrong-host.invalid');assert.equal(wrongOrigin.status,403);assert.equal((await wrongOrigin.json()).error,'Origin rejected');
 for(const username of ['fictionaluser','FICTIONALUSER',' FictionalUser','FictionalUser ']){const response=await login(username);assert.equal(response.status,401);assert.equal((await response.json()).error,'Login failed');}
 // A successful exact login clears its account budget; isolate the ten-failure threshold.
 assert.equal((await login('FictionalUser')).status,200);for(let i=0;i<10;i++)assert.equal((await login('FictionalUser','wrong-fictional-password')).status,401);const limited=await login('FictionalUser');assert.equal(limited.status,429);assert.equal((await limited.json()).error,'Try again later');assert.equal((await session(cookieA)).status,200);assert.equal((await session(cookieB)).status,200);
});
