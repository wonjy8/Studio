import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../server/store.js';
test('invitation windows, atomic capacity and unlimited/revoked links',async t=>{
 const dir=await mkdtemp('/tmp/studio-invite-options-'),origin='http://localhost';const {server,db}=await createApp({dir,origin,secure:false});
 db.prepare('INSERT INTO users VALUES(?,?,?)').run('owner','owner',await hashPassword('Fictional!8'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,data,cookie='',method='POST')=>fetch(base+'/api/'+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const login=await call('login',{username:'owner',password:'Fictional!8'});const cookie=login.headers.get('set-cookie').split(';')[0];
 for(const hours of [12,24,48]){const start=Date.now();const r=await call('invitations',{hours,maxUses:2},cookie);assert.equal(r.status,201);const inv=await r.json();assert.ok(Math.abs(inv.expires-start-hours*3600000)<2000);}
 for(const opts of [{hours:1},{hours:'12'},{maxUses:0},{maxUses:-1},{maxUses:1.5},{maxUses:'unlimited'},{maxUses:1e20}])assert.equal((await call('invitations',opts,cookie)).status,400);
 const make=async maxUses=>{const r=await call('invitations',{hours:12,maxUses},cookie);assert.equal(r.status,201);return r.json();};
 const inv=await make(2),token=inv.url.split('#invite=')[1];
 const result=await Promise.all(['first','second','third'].map(username=>call('signup',{token,username,password:'Fictional!8'})));
 assert.equal(result.filter(x=>x.status===201).length,2);assert.equal(db.prepare('SELECT use_count FROM invitations WHERE id=?').get(inv.id).use_count,2);
 const unlimited=await make(null),unlimitedToken=unlimited.url.split('#invite=')[1];
 for(const username of ['fourth','fifth','sixth'])assert.equal((await call('signup',{token:unlimitedToken,username,password:'Fictional!8'})).status,201);
 assert.equal((await call('invitations/'+unlimited.id,undefined,cookie,'DELETE')).status,200);
 assert.equal((await call('signup',{token:unlimitedToken,username:'seventh',password:'Fictional!8'})).status,400);
 const list=await (await call('invitations',undefined,cookie,'GET')).json();assert.equal(list.invitations.find(i=>i.id===unlimited.id).use_count,3);
});
test('old unused and consumed invitation records migrate safely and repeatedly',async()=>{
 const dir=await mkdtemp('/tmp/studio-invite-migrate-');let db=new DatabaseSync(dir+'/studio.sqlite');
 db.exec("CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);INSERT INTO users VALUES('owner','owner','fictional');CREATE TABLE invitations(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,expires INTEGER NOT NULL,used_at INTEGER,revoked_at INTEGER);INSERT INTO invitations VALUES('old','digest','owner',0,100,NULL,NULL);INSERT INTO invitations VALUES('used','other','owner',0,100,50,NULL);");db.close();
 for(let i=0;i<2;i++){db=openStore(dir);assert.equal(db.prepare("SELECT max_uses,use_count FROM invitations WHERE id='old'").get().max_uses,1);assert.equal(db.prepare("SELECT use_count FROM invitations WHERE id='used'").get().use_count,1);db.close();}
 await rm(dir,{recursive:true,force:true});
});
