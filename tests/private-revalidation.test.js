import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {newDocument} from '../src/domain/documents.js';
import {randomUUID} from 'node:crypto';

test('private conditional reads skip payload allocation, revalidate changes and enforce current session/access',async t=>{
 const dir=await mkdtemp('/tmp/studio-revalidation-fictional-');
 const app=await createApp({dir,origin:'http://localhost',secure:false});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 for(const uid of ['fictional-a','fictional-b']){
  app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused');
  app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);
 }
 const base='http://127.0.0.1:'+app.server.address().port;
 const get=(path,etag,uid='fictional-a')=>fetch(base+path,{headers:{Cookie:'studio_session='+uid,...(etag?{'If-None-Match':etag}:{})}});
 const doc=newDocument('Fictional document');
 app.db.prepare('INSERT INTO document_library VALUES(?,?,?)').run('fictional-a',JSON.stringify([doc]),1);
 const resources=[];
 for(const table of ['files','school_files']){
  const id=randomUUID(),bytes=Buffer.alloc(2*1024*1024,113);
  app.db.prepare('INSERT INTO '+table+' VALUES(?,?,?,?,?)').run(id,'fictional-a','fixture.bin','image/png',bytes);
  resources.push('/api/'+(table==='files'?'':'school/')+'files/'+id);
 }
 const imageId=randomUUID();app.db.prepare('INSERT INTO document_files VALUES(?,?,?,?,?,?)').run(imageId,'fictional-a','fixture.png','image/png','fixture-digest',Buffer.alloc(1024));resources.push('/api/document-files/'+imageId);
 for(const path of [...resources,'/api/document-library']){
  const first=await get(path),tag=first.headers.get('etag');assert.equal(first.status,200);assert.ok(tag);assert.match(first.headers.get('cache-control'),/private, no-cache, must-revalidate/);await first.arrayBuffer();
  // Conditional reads must not select a BLOB or parse/serialize document body.
  const prepare=app.db.prepare.bind(app.db);app.db.prepare=sql=>{
   if(/SELECT bytes|SELECT body,revision/.test(sql))throw Error('Payload read during 304');return prepare(sql);
  };
  let second;try{second=await get(path,tag);assert.equal(second.status,304);assert.equal((await second.arrayBuffer()).byteLength,0);}finally{app.db.prepare=prepare;}
  const other=await get(path,tag,'fictional-b');assert.equal(other.status,path==='/api/document-library'?200:404);await other.arrayBuffer();
  const noSession=await get(path,tag,'fictional-missing');assert.equal(noSession.status,401);await noSession.arrayBuffer();
 }
 const first=await get('/api/document-library'),oldTag=first.headers.get('etag');await first.arrayBuffer();
 doc.title='Changed elsewhere';app.db.prepare('UPDATE document_library SET body=?,revision=2 WHERE user_id=?').run(JSON.stringify([doc]),'fictional-a');
 const latest=await get('/api/document-library',oldTag);assert.equal(latest.status,200);assert.notEqual(latest.headers.get('etag'),oldTag);assert.equal((await latest.json()).documents[0].title,'Changed elsewhere');
 const file=await get(resources[0]),fileTag=file.headers.get('etag');await file.arrayBuffer();app.db.prepare('DELETE FROM files WHERE id=?').run(resources[0].split('/').at(-1));assert.equal((await get(resources[0],fileTag)).status,404);
 app.db.prepare('DELETE FROM sessions WHERE user_id=?').run('fictional-a');assert.equal((await get('/api/document-library',oldTag)).status,401);
});
