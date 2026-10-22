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
 // A malformed legacy spatial layout must not erase written notes.
 app.db.prepare('INSERT INTO reference_boards VALUES(?,?,?,?)').run('owner',id,JSON.stringify({items:[{key:'text:legacy',kind:'text',title:'Original',text:'Keep this note',x:-1,y:0,w:0,h:0}]}),1);
 const legacy=await call('reference-boards/'+id);assert.equal(legacy.body.items[0].text,'Keep this note');assert.equal(legacy.body.layout.modules[0].title,'Original');
 app.db.prepare('DELETE FROM reference_boards WHERE reference_id=?').run(id);
 const initial=await call('reference-boards/'+id);assert.equal(initial.status,200);assert.deepEqual(initial.body.items,[]);
 const items=[{key:'text:note-one',kind:'text',title:'Mood',text:'Cool blue\nSoft daylight',x:4,y:2,w:4,h:3}];
 const saved=await call('reference-boards/'+id,'PUT',{items});assert.equal(saved.status,200);assert.equal(saved.body.items[0].text,'Cool blue\nSoft daylight');
 const reopened=await call('reference-boards/'+id);assert.equal(reopened.body.items[0].x,4);assert.equal(reopened.body.items[0].y,2);assert.equal(reopened.body.items[0].w,4);
 assert.equal((await call('reference-boards/'+id,'GET',undefined,'other')).status,404);
 const layout=reopened.body.layout;layout.modules[0].title='Version 1';
 const modular=await call('reference-boards/'+id,'PUT',{items,layout,updatedAt:reopened.body.updatedAt});assert.equal(modular.status,200);assert.equal(modular.body.layout.modules[0].title,'Version 1');
 assert.equal((await call('reference-boards/'+id,'PUT',{items,layout,updatedAt:reopened.body.updatedAt})).status,409);
 const invalid=structuredClone(layout);invalid.flow.push(invalid.flow[0]);assert.equal((await call('reference-boards/'+id,'PUT',{items,layout:invalid,updatedAt:modular.body.updatedAt})).status,400);
 assert.equal((await call('reference-boards/'+id,'PUT',{items,layout,updatedAt:modular.body.updatedAt},'other')).status,404);
 for(const malformed of [null,{version:2,modules:[],flow:[null]}]){assert.equal((await call('reference-boards/'+id,'PUT',{items,layout:malformed,updatedAt:(await call('reference-boards/'+id)).body.updatedAt})).status,malformed===null?200:400);}
 const current=await call('reference-boards/'+id),unlinked=await call('reference-boards/'+id,'PUT',{items,layout:{version:2,modules:[],flow:[]},updatedAt:current.body.updatedAt});assert.equal(unlinked.status,200);
 const restoredRead=await call('reference-boards/'+id);assert.deepEqual(restoredRead.body.layout.modules,[]);assert.equal(restoredRead.body.items[0].text,items[0].text,'excluding a module preserves recoverable text');


 const overlap=await call('reference-boards/'+id,'PUT',{items:[...items,{key:'text:note-two',kind:'text',title:'',text:'overlap',x:5,y:3,w:3,h:2}]});assert.equal(overlap.status,409);
});

test('Reference pages preserve legacy content and isolated empty tabs across new and legacy writes',async t=>{const dir=await mkdtemp('/tmp/studio-reference-pages-api-'),origin='http://localhost',app=await createApp({dir,origin,secure:false});for(const uid of ['owner','other']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});const base='http://127.0.0.1:'+app.server.address().port,call=async(path,method='GET',body,uid='owner')=>{const r=await fetch(base+'/api/'+path,{method,headers:{Cookie:'studio_session='+uid,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};};const id=(await call('reference-library','POST',{name:'Reference',notes:'',url:'',tags:'',collection:'',images:[],files:[]})).body.reference.id,path='reference-boards/'+id,items=[{key:'text:original',kind:'text',title:'Original',text:'Preserve all legacy content',x:0,y:0,w:4,h:4}];let saved=await call(path,'PUT',{items});assert.equal(saved.status,200);assert.equal(saved.body.pages.length,1);const originalLayout=structuredClone(saved.body.layout),firstId=saved.body.pages[0].id,empty={id:'second',name:'독립 페이지',layout:{version:2,modules:[],flow:[]}};saved=await call(path,'PUT',{items,layout:saved.body.layout,pages:[...saved.body.pages,empty],selectedPageId:'second',updatedAt:saved.body.updatedAt});assert.equal(saved.status,200);assert.deepEqual(saved.body.pages[0].layout,originalLayout);assert.equal(saved.body.selectedPageId,'second');const read=await call(path);assert.equal(read.body.pages.length,2);assert.equal(read.body.items[0].text,items[0].text);assert.equal((await call(path,'GET',undefined,'other')).status,404);assert.equal((await call(path,'PUT',{...saved.body},'other')).status,404);const legacy=structuredClone(read.body.layout);legacy.modules[0].title='Legacy API edit';saved=await call(path,'PUT',{items,layout:legacy,updatedAt:read.body.updatedAt});assert.equal(saved.status,200);assert.equal(saved.body.pages.length,2);assert.equal(saved.body.pages[1].name,'독립 페이지');assert.equal(saved.body.selectedPageId,'second');assert.equal(saved.body.pages[0].layout.modules[0].title,'Legacy API edit');assert.deepEqual(saved.body.pages[1].layout.modules,[]);assert.equal((await call(path,'PUT',{...read.body,updatedAt:read.body.updatedAt})).status,409);const invalid=structuredClone(saved.body);invalid.pages.push({...invalid.pages[0],id:'duplicate-items'});assert.equal((await call(path,'PUT',invalid)).status,400);assert.equal((await call(path)).body.items[0].text,'Preserve all legacy content');});
