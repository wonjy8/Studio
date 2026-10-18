import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
test('shared project grants read-only projection and cannot authorize owner project mutations',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-shared-readonly-')),origin='http://localhost';const {server,db}=await createApp({dir,origin,secure:false});
 for(const id of ['fictional-owner','fictional-invitee','fictional-outsider']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(id+'-session'),id,Date.now()+60000);}
 const owner=emptyWorkspace();owner.project.id='owner-project';owner.project.name='Fictional Shared Project';owner.members=[{id:'owner-person',name:'Fictional Crew',role:'',call:''}];owner.gear=[{id:'owner-gear',name:'Fictional Camera',category:'camera',owner:'',assignee:'',status:'check'}];const hidden=emptyWorkspace();hidden.project.id='owner-private';hidden.project.name='PRIVATE_PROJECT_SENTINEL';hidden.refs=[{id:'private-ref',name:'PRIVATE_FILE_META_SENTINEL',notes:'',images:['/api/files/PRIVATE_FILE_SENTINEL']}];owner.projects=[hidden];owner.settings.privateToken='PRIVATE_SETTINGS_SENTINEL';owner.refs=[{id:'shared-ref',name:'Fictional Shared Reference',notes:'',images:['/api/files/SHARED_PRIVATE_ATTACHMENT_SENTINEL']}];owner.contents=[{id:'shared-shoot',name:'Fictional Shoot',time:'',location:'',status:'check',script:true,scriptFile:'SHARED_PRIVATE_SCRIPT_SENTINEL'}];db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('fictional-owner',7,JSON.stringify(owner));db.prepare('INSERT INTO project_accounts VALUES(?,?,?,?,?)').run('fictional-owner','owner-project','fictional-invitee','invitee-person',Date.now());
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,method='GET',data,user='fictional-invitee')=>fetch(base+path,{method,headers:{Origin:origin,Cookie:`studio_session=${user}-session`,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 const sharedPath='/api/projects/owner-project/shared?owner=fictional-owner';let response=await call(sharedPath);assert.equal(response.status,200);const projection=await response.json();assert.equal(projection.readOnly,true);assert.equal(projection.project.project.name,'Fictional Shared Project');assert.equal(projection.project.projects,undefined);assert.equal(projection.project.settings,undefined);for(const sentinel of ['PRIVATE_PROJECT_SENTINEL','PRIVATE_FILE_META_SENTINEL','PRIVATE_FILE_SENTINEL','PRIVATE_SETTINGS_SENTINEL','SHARED_PRIVATE_ATTACHMENT_SENTINEL','SHARED_PRIVATE_SCRIPT_SENTINEL'])assert.equal(JSON.stringify(projection).includes(sentinel),false);assert.equal((await call(sharedPath,'GET',undefined,'fictional-outsider')).status,404);
 const discover=await (await call('/api/shared-projects')).json();assert.deepEqual(discover.projects.map(p=>p.projectId),['owner-project']);assert.equal(JSON.stringify(discover).includes('PRIVATE_'),false);
 const original=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get('fictional-owner');const links=db.prepare('SELECT * FROM project_accounts').all();
 for(const [path,method,data] of [
 ['/api/projects/owner-project/members','POST',{userId:'fictional-outsider'}],
 ['/api/projects/owner-project/teams','POST',{name:'Unauthorized Team'}],
 ['/api/projects/owner-project/members/owner-person/teams','PUT',{teamIds:[]}],
 ['/api/projects/owner-project/equipment/owner-gear/assignments','PUT',{revision:0,values:{ownerMemberId:null,assigneeMemberId:null,owner:'Unauthorized Owner',assignee:'Unauthorized Assignee'}}],
 ['/api/projects/owner-project/equipment-links','POST',{equipmentId:'owner-private-equipment'}],
 [sharedPath,'PUT',{project:{name:'Unauthorized'}}]
 ])assert.equal((await call(path,method,data)).status,404,path);
 assert.deepEqual(db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get('fictional-owner'),original);assert.deepEqual(db.prepare('SELECT * FROM project_accounts').all(),links);assert.equal(db.prepare('SELECT count(*) n FROM project_teams').get().n,0);
 // Even a client that submits an owner-shaped snapshot only saves its own workspace.
 const forged=emptyWorkspace();forged.project.id='owner-project';forged.project.name='Fictional Invitee Copy';assert.equal((await call('/api/workspace','PUT',{revision:0,state:forged})).status,200);assert.deepEqual(db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get('fictional-owner'),original);
 assert.equal((await call('/api/projects/owner-project/equipment/owner-gear/assignments','PUT',{revision:1,values:{ownerMemberId:null,assigneeMemberId:null,owner:'Unauthorized',assignee:''}})).status,404);
 db.prepare('DELETE FROM project_accounts WHERE owner_id=? AND project_id=? AND user_id=?').run('fictional-owner','owner-project','fictional-invitee');assert.equal((await call(sharedPath)).status,404);assert.deepEqual((await (await call('/api/shared-projects')).json()).projects,[]);assert.deepEqual(db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get('fictional-owner'),original);
});
