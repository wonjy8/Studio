import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';

test('reference creation retries are idempotent, owner-scoped and stale differing updates cannot overwrite',async t=>{
 const dir=await mkdtemp('/tmp/reference-autosave-test-'),origin='http://localhost',app=await createApp({dir,origin,secure:false});
 for(const uid of ['owner','other']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 const key='10000000-0000-4000-8000-000000000001',base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,method,body,uid='owner',createKey)=>{const response=await fetch(base+'/api/'+path,{method,headers:{Cookie:'studio_session='+uid,Origin:origin,'Content-Type':'application/json',...(createKey?{'X-Studio-Reference-Create':createKey}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
 const draft={name:'Fixture',notes:'',url:'',tags:'',collection:'',images:[],files:[]};
 const first=await call('reference-library','POST',draft,'owner',key);assert.equal(first.status,201);assert.equal(first.body.reference.id,key);
 const retry=await call('reference-library','POST',draft,'owner',key);assert.equal(retry.status,200);assert.equal(retry.body.reference.revision,1);assert.equal(app.db.prepare('SELECT count(*) n FROM reference_library').get().n,1);
 assert.equal((await call('reference-library','POST',draft,'other',key)).status,409);
 assert.equal((await call('reference-library','POST',{...draft,name:'Different'},'owner',key)).status,409);
 assert.equal((await call('reference-library','POST',draft,'owner','invalid')).status,400);
 const updated=await call('reference-library/'+key,'PUT',{...draft,notes:'Saved note',revision:1});assert.equal(updated.status,200);assert.equal(updated.body.reference.revision,2);
 const repeated=await call('reference-library/'+key,'PUT',{...draft,notes:'Saved note',revision:1});assert.equal(repeated.status,200);assert.equal(repeated.body.reference.revision,2);
 assert.equal((await call('reference-library/'+key,'PUT',{...draft,notes:'Stale overwrite',revision:1})).status,409);
 assert.equal((await call('reference-library/'+key,'DELETE',{revision:1})).status,409);
});
