// Isolated modal-draft regression with delayed invitation responses; all records are fictional.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects} from '../src/domain/projects.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const base=`http://127.0.0.1:${port}`,dir=await mkdtemp(join(tmpdir(),'studio-modal-draft-')),app=await createApp({dir,origin:base,secure:false});
const username='fictional-modal-draft',password='Fictional!Save2026';
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(username,username,await hashPassword(password));
for(const id of ['fictional-invite-a','fictional-invite-b','fictional-invite-c'])app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,'unused-hash');
const state=prepareProjects(emptyWorkspace());state.tasks=[{id:'fictional-task',name:'Fictional saved task',completed:false}];state.gear=[{id:'fictional-gear',name:'Fictional light',category:'lighting',status:'check',owner:'Fictional saved owner',assignee:''}];state.project.name='Fictional baseline';state.members=[{id:'fictional-member',name:'Fictional Crew',role:'Crew',call:''}];
app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(username,1,JSON.stringify(state));
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],observations=[];
try{
 for(const [kind,target] of [['task','fictional-invite-a'],['gear','fictional-invite-b'],['settings','fictional-invite-c']]){
  const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let releaseInvite,inviteReady,inviteDelivered,workspaceReads=0,putStatus;
  page.on('request',request=>{if(request.url()===base+'/api/workspace'&&request.method()==='GET')workspaceReads++;});
  page.on('response',response=>{if(response.url()===base+'/api/workspace'&&response.request().method()==='PUT')putStatus=response.status();if(response.url().endsWith('/assignments'))putStatus=response.status();});
  await page.route('**/api/projects/*/members',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();assert.equal(response.status(),201);inviteReady();await new Promise(resolve=>releaseInvite=resolve);await route.fulfill({response});inviteDelivered();});
  await page.goto(base);await page.getByLabel('사용자 이름',{exact:true}).fill(username);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.locator('#login button[type=submit]').click();
  await page.locator('[data-view=members]').click();await page.locator('[data-account-search] [name=q]').fill(target);await page.locator('[data-account-search] button').click();await page.locator(`[data-invite-account="${target}"]`).waitFor();
  const ready=new Promise(resolve=>inviteReady=resolve),delivered=new Promise(resolve=>inviteDelivered=resolve);await page.locator(`[data-invite-account="${target}"]`).click();await ready;
  if(kind==='settings')await page.locator('[data-view=project-settings]').click();
  if(kind!=='settings'){
   await page.locator(`[data-view="${kind==='task'?'tasks':'gear'}"]`).click();
   await page.locator(kind==='task'?'[data-edit-task="fictional-task"]':'[data-edit-equipment="fictional-gear"]').click();
  }
  const inputSelector=kind==='task'?'[data-form=task-edit] [name=name]':kind==='gear'?'[data-form=equipment-edit] [name=owner]':'#project-name';
  const input=page.locator(inputSelector),typed=`Fictional unsaved ${kind} draft`;await input.fill(typed);
  // A shell-only render must retain both named values and editor focus.
  await page.evaluate(()=>document.querySelector('[data-action=toggle-sidebar]').click());assert.equal(await input.inputValue(),typed);
  if(kind!=='settings')assert.equal(await input.evaluate(node=>node===document.activeElement),true);
  const readsBefore=workspaceReads;releaseInvite();await delivered;await page.waitForTimeout(150);
  assert.equal(workspaceReads,readsBefore,'Editing must block workspace refresh and revision adoption');assert.equal(await input.inputValue(),typed);
  const storedBefore=app.db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(username);
  await page.locator(kind==='settings'?'[data-form=project] > button':`[data-form=${kind==='task'?'task-edit':'equipment-edit'}] > button[type=submit]`).click();
  await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장 실패');assert.equal(putStatus,409);assert.equal(await page.locator('[data-action=retry-save]').count(),0);
  assert.ok((await page.locator('.content').innerText()).includes(typed)||kind==='settings'&&await page.locator('#project-name').inputValue()===typed,'Conflict must retain visible local intent');
  const storedAfter=app.db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(username);assert.deepEqual(storedAfter,storedBefore,'Conflict must not overwrite committed invitation/server data');
  observations.push({kind,draftPreserved:true,refreshSkipped:true,conflict:putStatus,serverUnchanged:true});console.log(JSON.stringify(observations.at(-1)));await page.close();
 }
 for(const kind of ['task','gear']){
  const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let releaseProfile,profileReady,profileDelivered;
  await page.route('**/api/account/profile',async route=>{const response=await route.fetch();assert.equal(response.status(),200);profileReady();await new Promise(resolve=>releaseProfile=resolve);await route.fulfill({response});profileDelivered();});
  await page.goto(base);await page.getByLabel('사용자 이름',{exact:true}).fill(username);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.locator('#login button[type=submit]').click();await page.locator('[data-view=settings]').click();
  await page.locator('[data-edit-name]').click();await page.locator('[data-account-profile] [name=name]').fill(`Fictional profile ${kind}`);const ready=new Promise(resolve=>profileReady=resolve),delivered=new Promise(resolve=>profileDelivered=resolve);await page.locator('#account-name').press('Enter');await ready;await page.locator('[data-action=production]').click();
  await page.locator(`[data-view="${kind==='task'?'tasks':'gear'}"]`).click();await page.locator(kind==='task'?'[data-edit-task="fictional-task"]':'[data-edit-equipment="fictional-gear"]').click();
  const form=page.locator(`[data-form=${kind==='task'?'task-edit':'equipment-edit'}]`);const typed=`Fictional profile-rerender ${kind} draft`;
  if(kind==='gear'){await form.locator('[name=ownerMode]').selectOption('member');await form.locator('[name=ownerMemberId]').selectOption('fictional-member');await form.locator('[name=assigneeMode]').selectOption('manual');}
  const input=form.locator(`[name=${kind==='task'?'name':'assignee'}]`);await input.fill(typed);await input.evaluate(node=>node.setSelectionRange(4,8));
  await page.evaluate(()=>window.__modalBeforeProfile=document.querySelector('[data-modal-panel] form'));releaseProfile();await delivered;assert.equal(await page.evaluate(()=>document.querySelector('[data-modal-panel] form')===window.__modalBeforeProfile),true);
  assert.equal(await input.inputValue(),typed);assert.equal(await input.evaluate(node=>node===document.activeElement),true);assert.deepEqual(await input.evaluate(node=>[node.selectionStart,node.selectionEnd]),[4,8]);
  if(kind==='gear'){assert.equal(await form.locator('[name=ownerMode]').inputValue(),'member');assert.equal(await form.locator('[name=ownerMemberId]').inputValue(),'fictional-member');assert.equal(await form.locator('[name=assigneeMode]').inputValue(),'manual');assert.ok(await form.locator('[name=ownerMemberId]').isEnabled());assert.ok(await input.isEnabled());}
  await page.keyboard.press('Escape');await page.locator('[data-view=settings]').click();await page.getByText(`Fictional profile ${kind}`,{exact:true}).waitFor();console.log(`PASS delayed profile response preserves ${kind} editor values, modes, focus and selection without replacing the editor; updated profile appears on next visit`);await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS delayed invitations preserve modal/main settings drafts and stale revision; explicit save409 retains local intent without overwriting server');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
