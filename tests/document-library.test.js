import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {purgeCompleteAccount} from '../server/account-complete-deletion.js';
import {writeWorkspace} from '../server/workspace-service.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects} from '../src/domain/projects.js';
import {digest} from '../server/auth.js';
import {newDocument} from '../src/domain/documents.js';
import {parseRoute,routePath} from '../src/app/routes.js';

test('document workspace addresses preserve account namespace and selected document independently of projects',()=>{
 for(const username of [undefined,'fictional-owner'])for(const view of ['document-workspace','references']){const path=routePath({view,username,project:{id:'p',name:'Project'},documentId:'document-one'}),route=parseRoute(path);assert.equal(route.valid,true);assert.equal(route.view,view);assert.equal(route.documentId,'document-one');if(username)assert.equal(route.username,username);}
 assert.equal(parseRoute('/fictional-owner/documents').view,'document-workspace');assert.equal(parseRoute('/documents?document=invalid%2Fid').documentId,undefined);
});
test('account documents are isolated, revision protected, validate rich text and survive unrelated project writes',async t=>{
 const dir=await mkdtemp('/tmp/studio-document-library-'),app=await createApp({dir,origin:'http://localhost',secure:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});});
 for(const uid of ['first','second']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,'fictional-'+uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid+'-cookie'),uid,Date.now()+60000);}
 const base='http://127.0.0.1:'+app.server.address().port;
 const call=async(uid,body)=>{const r=await fetch(base+'/api/document-library',{method:body?'PUT':'GET',headers:{Origin:'http://localhost',...(uid?{cookie:'studio_session='+uid+'-cookie'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};};
 assert.equal((await call(null)).status,401);assert.deepEqual((await call('first')).documents,[]);const doc=newDocument('Independent');let saved=await call('first',{revision:0,documents:[doc]});assert.equal(saved.status,200);assert.equal(saved.revision,1);assert.deepEqual((await call('second')).documents,[]);
 const newer=structuredClone(doc);newer.blocks[0].content=[{text:'New content',bold:true}];saved=await call('first',{revision:1,documents:[newer]});assert.equal(saved.revision,2);assert.equal((await call('first',{revision:1,documents:[newer]})).status,200);assert.equal((await call('first',{revision:1,documents:[doc]})).status,409);
 const bad=structuredClone(newer);bad.blocks[0].content[0].href='javascript:alert(1)';assert.equal((await call('first',{revision:2,documents:[bad]})).status,400);assert.equal((await call('first',{revision:2,documents:[newer],owner:'second'})).status,400);assert.deepEqual((await call('first')).documents,[newer]);writeWorkspace(app.db,'first',prepareProjects(emptyWorkspace()),0);assert.deepEqual((await call('first')).documents,[newer]);
 assert.equal((await call('first',{revision:2,documents:[]})).status,200);assert.deepEqual((await call('first')).documents,[]);await call('first',{revision:3,documents:[newer]});const other=newDocument('Other account');await call('second',{revision:0,documents:[other]});app.db.exec('BEGIN IMMEDIATE');try{purgeCompleteAccount(app.db,'second','first');app.db.exec('COMMIT');}catch(error){app.db.exec('ROLLBACK');throw error;}assert.equal(app.db.prepare('SELECT 1 FROM document_library WHERE user_id=?').get('first'),undefined);assert.deepEqual((await call('second')).documents,[other]);
});
