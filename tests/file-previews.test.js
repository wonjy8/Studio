import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {randomUUID,createHash} from 'node:crypto';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');

test('bounded derivatives preserve originals, enforce owner writes, private reads, quota and delete cascade',async t=>{
 const dir=await mkdtemp('/tmp/studio-preview-fixture-'),app=await createApp({dir,origin:'http://localhost',secure:false});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 for(const uid of ['fictional-owner','fictional-other']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
 const id=randomUUID(),original=Buffer.concat([png,Buffer.alloc(2*1024*1024,113)]),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 app.db.prepare('INSERT INTO files VALUES(?,?,?,?,?)').run(id,'fictional-owner','fixture.png','image/png',original);
 const packet=(small=png,reference=png)=>{const sizes=Buffer.alloc(8);sizes.writeUInt32LE(small.length);sizes.writeUInt32LE(reference.length,4);return Buffer.concat([sizes,small,reference]);};
 const path='/api/files/'+id,base='http://127.0.0.1:'+app.server.address().port;
 const call=(url,{uid='fictional-owner',method='GET',body,type='image/png',etag}={})=>fetch(base+url,{method,headers:{Origin:'http://localhost',Cookie:'studio_session='+uid,'Content-Type':url.endsWith('/preview')?'application/octet-stream':type,'X-Thumbnail-Type':type,'X-Reference-Type':type,...(etag?{'If-None-Match':etag}:{})},body});
 assert.equal((await call(path+'?preview=1')).status,404);
 assert.equal((await call(path+'/preview',{method:'PUT',body:packet()})).status,200);
 assert.equal((await call(path+'/preview',{method:'PUT',body:packet()})).status,200);assert.equal(app.db.prepare('SELECT count(*) n FROM file_previews').get().n,2);
 app.db.prepare('DELETE FROM file_previews WHERE file_id=?').run(id);
 app.db.exec("CREATE TEMP TRIGGER fail_reference_preview BEFORE INSERT ON file_previews WHEN NEW.variant='reference' BEGIN SELECT RAISE(ABORT,'fictional write failure'); END");
 assert.equal((await call(path+'/preview',{method:'PUT',body:packet()})).status,500);assert.equal(app.db.prepare('SELECT count(*) n FROM file_previews').get().n,0);assert.equal(app.db.prepare('SELECT count(*) n FROM files').get().n,1);
 app.db.exec('DROP TRIGGER fail_reference_preview');assert.equal((await call(path+'/preview',{method:'PUT',body:packet()})).status,200);
 const preview=await call(path+'?preview=1'),etag=preview.headers.get('etag');assert.equal(preview.status,200);assert.equal((await preview.arrayBuffer()).byteLength,png.length);assert.equal((await call(path+'?preview=1',{etag})).status,304);
 const medium=await call(path+'?preview=reference');assert.equal(medium.status,200);assert.equal((await medium.arrayBuffer()).byteLength,png.length);
 assert.equal(hash(Buffer.from(await(await call(path)).arrayBuffer())),hash(original));
 assert.equal((await call(path+'?preview=1',{uid:'fictional-other',etag})).status,404);
 assert.equal((await call(path+'/preview',{uid:'fictional-other',method:'PUT',body:packet()})).status,404);
 assert.equal((await call(path+'/preview',{method:'PUT',body:Buffer.from('not image')})).status,400);
 const huge=Buffer.from(png);huge.writeUInt32BE(9000,16);assert.equal((await call(path+'/preview',{method:'PUT',body:packet(huge)})).status,400);
 assert.equal((await call(path+'/preview',{method:'PUT',body:Buffer.alloc(512*1024+1000000+9)})).status,413);
 assert.equal((await call(path+'/preview',{method:'PUT',body:packet(),type:'image/svg+xml'})).status,415);
 assert.equal((await call(path+'/preview',{method:'PUT',body:packet(),type:'image/jpeg'})).status,400);
 const changed=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKAAAAABJRU5ErkJggg==','base64');assert.equal((await call(path+'/preview',{method:'PUT',body:packet(changed,changed)})).status,200);const updated=await call(path+'?preview=1',{etag});assert.equal(updated.status,200);assert.notEqual(updated.headers.get('etag'),etag);await updated.arrayBuffer();
 app.db.prepare('DELETE FROM files WHERE id=?').run(id);assert.equal(app.db.prepare('SELECT count(*) n FROM file_previews').get().n,0);assert.equal((await call(path+'?preview=1',{etag})).status,404);
});
