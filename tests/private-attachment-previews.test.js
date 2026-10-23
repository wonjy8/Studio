import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {randomUUID,createHash} from 'node:crypto';
import {emptySchool} from '../src/domain/school.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
test('document and school derivatives retain original identity, current authorization, atomic retry and cascade',async t=>{
 const dir=await mkdtemp('/tmp/studio-private-variant-'),app=await createApp({dir,origin:'http://localhost',secure:false});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 for(const uid of ['fixture-a','fixture-b']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,{uid='fixture-a',method='GET',body,context,etag}={})=>fetch(base+'/api/'+path,{method,headers:{Origin:'http://localhost',Cookie:'studio_session='+uid,'Content-Type':'application/octet-stream','X-Thumbnail-Type':'image/png','X-Reference-Type':'image/png',...(context?{'X-Document-Context':context}:{}),...(etag?{'If-None-Match':etag}:{})},body});
 const context=(await(await call('document-files/context')).json()).editContext;
 const sizes=Buffer.alloc(8);sizes.writeUInt32LE(png.length);sizes.writeUInt32LE(png.length,4);const packet=Buffer.concat([sizes,png,png]),original=Buffer.concat([png,Buffer.alloc(1024,17)]);
 for(const [resource,table,derivatives]of [['school/files','school_files','school_file_previews'],['document-files','document_files','document_file_previews']]){
  const id=randomUUID(),path=resource+'/'+id;
  if(table==='document_files')app.db.prepare('INSERT INTO document_files VALUES(?,?,?,?,?,?)').run(id,'fixture-a','fixture.png','image/png',createHash('sha256').update(original).digest('hex'),original);
  else app.db.prepare('INSERT INTO school_files VALUES(?,?,?,?,?)').run(id,'fixture-a','fixture.png','image/png',original);
  if(table==='document_files')assert.equal((await call(path+'/preview',{method:'PUT',body:packet})).status,409);
  assert.equal((await call(path+'/preview',{method:'PUT',body:packet,context})).status,200);
  assert.equal((await call(path+'/preview',{method:'PUT',body:packet,context})).status,200);
  assert.equal(app.db.prepare('SELECT count(*) n FROM '+derivatives).get().n,2);
  const preview=await call(path+'?preview=reference'),etag=preview.headers.get('etag');assert.equal(preview.status,200);assert.deepEqual(Buffer.from(await preview.arrayBuffer()),png);
  assert.equal((await call(path+'?preview=reference',{etag})).status,304);
  assert.equal((await call(path+'?preview=reference',{uid:'fixture-b',etag})).status,404);
  assert.equal((await call(path+'/preview',{uid:'fixture-b',method:'PUT',body:packet,context})).status,table==='document_files'?409:404);
  assert.deepEqual(Buffer.from(await(await call(path)).arrayBuffer()),original);
  app.db.prepare('DELETE FROM '+table+' WHERE id=?').run(id);
  assert.equal(app.db.prepare('SELECT count(*) n FROM '+derivatives).get().n,0);
  assert.equal((await call(path+'?preview=reference',{etag})).status,404);
 }
 app.db.prepare('INSERT INTO school_workspaces VALUES(?,?,?)').run('fixture-a',JSON.stringify(emptySchool()),1);
 const first=await call('school'),etag=first.headers.get('etag');await first.arrayBuffer();assert.ok(etag);assert.equal((await call('school',{etag})).status,304);
 app.db.prepare('UPDATE school_workspaces SET revision=2 WHERE user_id=?').run('fixture-a');assert.equal((await call('school',{etag})).status,200);
 app.db.prepare('DELETE FROM sessions WHERE user_id=?').run('fixture-a');assert.equal((await call('school',{etag})).status,401);
});
