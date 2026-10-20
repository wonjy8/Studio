import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {newDocument} from '../src/domain/documents.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {routePath,parseRoute} from '../src/app/routes.js';
import {projectNavigation} from '../src/patterns/navigation.js';

async function fixture(t){
 const dir=await mkdtemp('/tmp/studio-material-library-'),origin='http://localhost',app=await createApp({dir,origin,secure:false});
 for(const uid of ['a','b']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,'materials-'+uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,method='GET',body,uid='a')=>{const response=await fetch(base+'/api/'+path,{method,headers:{Origin:origin,Cookie:'studio_session='+uid,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};};
 return {db:app.db,base,call};
}

test('uploads become private original materials with a recorded upload date',async t=>{
 const {call,base}=await fixture(t),response=await fetch(base+'/api/files',{method:'POST',headers:{Origin:'http://localhost',Cookie:'studio_session=a','Content-Type':'image/png','X-File-Name':encodeURIComponent('fictional-image.png')},body:Buffer.from('89504e470d0a1a0a','hex')});
 assert.equal(response.status,201);const uploaded=await response.json(),library=await call('materials');
 assert.equal(library.status,200);const item=library.body.items.find(entry=>entry.fileId===uploaded.id);
 assert.ok(item);assert.equal(item.title,'fictional-image.png');assert.equal(item.kind,'file');assert.ok(item.uploadedAt>0);
 assert.deepEqual((await call('materials','GET',undefined,'b')).body.items,[]);
});

test('links are validated, tagged, searchable metadata and do not fetch private HTTP addresses',async t=>{
 const {call}=await fixture(t);
 const invalid=await call('materials','POST',{url:'javascript:alert(1)',title:'bad'});assert.equal(invalid.status,400);
 const created=await call('materials','POST',{url:'http://127.0.0.1:1/private',title:'Fictional location',category:'Location',tags:'interview, night',description:'safe note'});
 assert.equal(created.status,201);assert.equal(created.body.item.title,'Fictional location');assert.deepEqual(created.body.item.tags,['interview','night']);assert.equal(created.body.item.previewTitle,'');
 const updated=await call('materials/'+created.body.item.id,'PUT',{title:'Updated location',category:'Place',tags:['night','exterior'],description:'updated'});
 assert.equal(updated.status,200);assert.deepEqual(updated.body.item.tags,['night','exterior']);
 assert.equal((await call('materials','GET',undefined,'b')).body.items.length,0);
});

test('file originals cannot be deleted while a reference still uses them',async t=>{
 const {call,base}=await fixture(t);
 const uploadedResponse=await fetch(base+'/api/files',{method:'POST',headers:{Origin:'http://localhost',Cookie:'studio_session=a','Content-Type':'image/png','X-File-Name':'image.png'},body:Buffer.from('89504e470d0a1a0a','hex')});
 const uploaded=await uploadedResponse.json(),list=await call('materials'),item=list.body.items.find(entry=>entry.fileId===uploaded.id);
 const reference=await call('reference-library','POST',{name:'Fictional board',images:[uploaded.url]});assert.equal(reference.status,201);
 const deleted=await call('materials/'+item.id,'DELETE');assert.equal(deleted.status,422);
 assert.equal((await call('materials')).body.items.some(entry=>entry.id===item.id),true);
});

test('new personal documents receive a creation date in All Materials and legacy document URLs stay valid',async t=>{
 const {call}=await fixture(t),doc=newDocument('Fictional document');
 const saved=await call('document-library','PUT',{documents:[doc],revision:0});assert.equal(saved.status,200);
 const library=await call('materials');assert.ok(library.body.documentDates['account:'+doc.id]>0);
 assert.equal(parseRoute('/documents?document='+doc.id).view,'document-workspace');
 assert.equal(parseRoute(routePath({view:'materials',username:'fictional'})).view,'materials');
 assert.ok(routePath({view:'materials',username:'fictional'}).endsWith('/dataspace/materials'));
});
test('Materials navigation groups documents under All Materials and keeps references separate',()=>{
 const html=projectNavigation(emptyWorkspace(),'materials',false,{});
 assert.match(html,/모든 자료/);assert.match(html,/레퍼런스/);assert.doesNotMatch(html,/data-view="document-workspace"/);
});

test('selection deletion preconditions reject stale and foreign items while preserving used reference links',async t=>{
 const {call,base,db}=await fixture(t),created=await call('materials','POST',{url:'http://127.0.0.1:1/fictional-selection',title:'Selection link',category:'',tags:[],description:''}),item=created.body.item;assert.ok(Number.isSafeInteger(item.updatedAt));
 const remove=async(uid,stamp)=>fetch(base+'/api/materials/'+item.id,{method:'DELETE',headers:{Origin:'http://localhost',Cookie:'studio_session='+uid,'If-Match':String(stamp)}});
 assert.equal((await remove('b',item.updatedAt)).status,404);db.prepare('UPDATE materials SET updated_at=updated_at+1 WHERE id=?').run(item.id);assert.equal((await remove('a',item.updatedAt)).status,409);assert.ok(db.prepare('SELECT id FROM materials WHERE id=?').get(item.id));const current=(await call('materials')).body.items.find(row=>row.id===item.id);assert.equal((await remove('a',current.updatedAt)).status,200);
 const used=await call('reference-library','POST',{name:'Used selection link',notes:'',url:'http://127.0.0.1:1/fictional-used',tags:'',collection:'',images:[],files:[]});assert.equal(used.status,201);const linked=(await call('materials')).body.items.find(row=>row.url==='http://127.0.0.1:1/fictional-used');assert.ok(linked);assert.equal((await fetch(base+'/api/materials/'+linked.id,{method:'DELETE',headers:{Origin:'http://localhost',Cookie:'studio_session=a','If-Match':String(linked.updatedAt)}})).status,422);assert.ok(db.prepare('SELECT id FROM materials WHERE id=?').get(linked.id));
});
