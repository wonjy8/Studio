import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {parseRoute,routePath} from '../src/app/routes.js';
test('rental vendors are account-private, validated and protected by revision and exact session',async t=>{
 const dir=await mkdtemp('/tmp/studio-vendors-'),origin='http://localhost',app=await createApp({dir,origin,secure:false});for(const uid of ['a','b']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,'fictional-'+uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path='',method='GET',body,uid='a',site=origin)=>{const result=await fetch(base+'/api/rental-vendors'+path,{method,headers:{Origin:site,...(uid?{Cookie:'studio_session='+uid}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:result.status,body:await result.json()};};
 assert.equal((await call('','GET',undefined,null)).status,401);assert.equal((await call('','POST',{name:'Bad'},'a','https://other.invalid')).status,403);assert.equal((await call('','POST',{name:'Bad',website:'javascript:alert(1)'})).status,400);
 const created=await call('','POST',{name:'Fictional Rental',phone:'000-0000'});assert.equal(created.status,201);const vendor=created.body.vendor;assert.equal((await call('','GET',undefined,'b')).body.vendors.length,0);assert.equal((await call('/'+vendor.id,'PUT',{name:'Forbidden',revision:1},'b')).status,404);assert.equal((await call('/'+vendor.id,'DELETE',{revision:1},'b')).status,404);
 assert.equal((await call('/'+vendor.id,'PUT',{name:'Changed',revision:0})).status,409);const updated=await call('/'+vendor.id,'PUT',{name:'Changed',revision:vendor.revision});assert.equal(updated.body.vendor.revision,2);assert.equal((await call('/'+vendor.id,'DELETE',{revision:1})).status,409);assert.equal((await call('/'+vendor.id,'DELETE',{revision:2})).status,200);assert.equal((await call()).body.vendors.length,0);
});
test('dataspace has clean account-scoped routes and survives direct navigation',()=>{const path=routePath({view:'dataspace',username:'fictional'});assert.equal(path,'/fictional/dataspace/rental-vendors');assert.equal(parseRoute(path).view,'dataspace');assert.equal(parseRoute(path).username,'fictional');assert.equal(parseRoute('/dataspace/rental-vendors').view,'dataspace');});
