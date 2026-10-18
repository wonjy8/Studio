import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {accountRoutes} from '../server/accounts.js';
import {adminProjectRoutes} from '../server/admin-projects.js';
import {digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'studio-fictional-team-cas-')),{db}=await createApp({dir,origin:'http://localhost',secure:false,enableSiteRoleManagement:true});t.after(async()=>{db.close();await rm(dir,{recursive:true,force:true});});
 for(const id of ['fictional-owner','fictional-admin']){db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'unused-fictional-hash');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(id),id,Date.now()+600000);}
 db.prepare("INSERT OR REPLACE INTO site_settings VALUES('super_admin_user_id','fictional-admin')").run();
 const state=emptyWorkspace(),other=emptyWorkspace();state.project.id='fictional-project';other.project.id='fictional-other';state.members=[{id:'fictional-member',name:'Fictional member',role:'',call:''}];other.members=structuredClone(state.members);state.projects=[other];db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('fictional-owner',4,JSON.stringify(state));
 for(const [id,pid]of [['team-a','fictional-project'],['team-b','fictional-project'],['team-other','fictional-other']])db.prepare('INSERT INTO project_teams VALUES(?,?,?,?)').run(id,'fictional-owner',pid,id);
 db.prepare('INSERT INTO project_team_members VALUES(?,?)').run('team-other','fictional-member');
 const ownerHandler=accountRoutes(db),adminHandler=adminProjectRoutes(db),ownerPath='/api/projects/fictional-project/members/fictional-member/teams',adminPath='/api/admin/projects/fictional-owner/fictional-project';
 async function invoke(handler,path,method,data,beforeRead=()=>{}){let result;try{await handler({path,url:new URL('http://localhost'+path),req:{method},session:{user_id:handler===ownerHandler?'fictional-owner':'fictional-admin',token:digest(handler===ownerHandler?'fictional-owner':'fictional-admin')},readJson:async()=>{await beforeRead();return data;},json:(status,body)=>result={status,body}});}catch(error){result={status:error.status||500,body:{error:error.message}};}return result;}
 const owner=(data,beforeRead)=>invoke(ownerHandler,ownerPath,'PUT',data,beforeRead),add=(data,beforeRead)=>invoke(ownerHandler,'/api/projects/fictional-project/teams','POST',data,beforeRead),admin=(revision,commands)=>invoke(adminHandler,adminPath,'PATCH',{revision,reason:'Fictional concurrency test',commands});
 const row=()=>db.prepare('SELECT * FROM workspaces WHERE user_id=?').get('fictional-owner'),members=()=>db.prepare('SELECT * FROM project_team_members ORDER BY team_id').all();return {db,owner,add,admin,row,members};
}
const assign=teamIds=>[{operation:'set_member_teams',entityId:'fictional-member',values:{teamIds}}];
test('owner assignment invalidates stale managed-team edit while preserving body and other project',async t=>{
 const {owner,admin,row,members}=await fixture(t),before=row();const saved=await owner({teamIds:['team-b']});assert.equal(saved.status,200);assert.equal(saved.body.revision,5);assert.equal(row().body,before.body);assert.equal((await admin(4,assign(['team-a']))).status,409);assert.deepEqual(members().map(m=>m.team_id),['team-b','team-other']);assert.equal(row().revision,5);
});
test('team creation bumps shared revision and rejects stale explicit revision without insertion',async t=>{
 const {add,admin,row,db}=await fixture(t),before=row().body;const saved=await add({name:'Fictional new team'});assert.equal(saved.status,201);assert.equal(saved.body.revision,5);assert.equal(row().body,before);assert.equal((await admin(4,assign(['team-a']))).status,409);assert.equal((await add({name:'Fictional stale team',revision:4})).status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM project_teams').get().n,4);
});
test('owner PUT and create held at request body reject intervening administrator changes',async t=>{
 for(const operation of ['assignment','creation']){const {owner,add,admin,row,members}=await fixture(t);let release,entered;const bodyWait=new Promise(r=>release=r),started=new Promise(r=>entered=r);const pending=(operation==='assignment'?owner({teamIds:['team-b']},async()=>{entered();await bodyWait;}):add({name:'Fictional late team'},async()=>{entered();await bodyWait;}));await started;assert.equal((await admin(4,assign(['team-a']))).status,200);release();assert.equal((await pending).status,409);assert.deepEqual(members().map(m=>m.team_id),['team-a','team-other']);assert.equal(row().revision,5);}
});
test('team scope validation and failed revision bump roll back memberships and creation atomically',async t=>{
 const {db,owner,add,row,members}=await fixture(t),before=row(),initial=members();assert.equal((await owner({teamIds:['team-other']})).status,400);assert.deepEqual(members(),initial);assert.deepEqual(row(),before);
 db.exec("CREATE TRIGGER fictional_revision_failure BEFORE UPDATE OF revision ON workspaces BEGIN SELECT RAISE(ABORT,'Fictional revision failure'); END");assert.equal((await owner({teamIds:['team-a','team-b']})).status,500);assert.deepEqual(members(),initial);assert.deepEqual(row(),before);assert.equal((await add({name:'Fictional rollback team'})).status,500);assert.equal(db.prepare('SELECT COUNT(*) n FROM project_teams').get().n,3);assert.deepEqual(row(),before);
});
