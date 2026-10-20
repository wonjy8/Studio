import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';

test('reference boards persist positioned text cards and stay private',async t=>{
 const dir=await mkdtemp('/tmp/studio-reference-board-'),origin='http://localhost',app=await createApp({dir,origin,secure:false});
 for(const uid of ['owner','other']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,'board-'+uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,method='GET',body,uid='owner')=>{const response=await fetch(base+'/api/'+path,{method,headers:{Origin:origin,Cookie:'studio_session='+uid,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};};
 const created=await call('reference-library','POST',{name:'Study board',notes:'',url:'',tags:'',collection:'',images:[],files:[]});assert.equal(created.status,201);const id=created.body.reference.id;
 const initial=await call('reference-boards/'+id);assert.equal(initial.status,200);assert.deepEqual(initial.body.items,[]);
 const items=[{key:'text:note-one',kind:'text',title:'Mood',text:'Cool blue\nSoft daylight',x:4,y:2,w:4,h:3}];
 const saved=await call('reference-boards/'+id,'PUT',{items});assert.equal(saved.status,200);assert.equal(saved.body.items[0].text,'Cool blue\nSoft daylight');
 const reopened=await call('reference-boards/'+id);assert.equal(reopened.body.items[0].x,4);assert.equal(reopened.body.items[0].y,2);assert.equal(reopened.body.items[0].w,4);
 assert.equal((await call('reference-boards/'+id,'GET',undefined,'other')).status,404);
 const overlap=await call('reference-boards/'+id,'PUT',{items:[...items,{key:'text:note-two',kind:'text',title:'',text:'overlap',x:5,y:3,w:3,h:2}]});assert.equal(overlap.status,400);
});
