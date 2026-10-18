import {parseRoute} from '../src/app/routes.js';
// Isolated repeated-retry/navigation ordering regression; all records are fictional.
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
const base=`http://127.0.0.1:${port}`,dir=await mkdtemp(join(tmpdir(),'studio-retry-nav-')),app=await createApp({dir,origin:base,secure:false});
const username='fictional-retry-navigation',password='Fictional!Save2026';
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(username,username,await hashPassword(password));
const state=prepareProjects(emptyWorkspace());state.project.name='Fictional baseline';state.members=[{id:'fictional-member',name:'Fictional Crew',role:'Crew',call:''}];
state.project.id='fictional-a';state.tasks=[{id:'task-a',name:'Fictional A unchanged',completed:true}];const other=structuredClone(state);delete other.projects;other.project.id='fictional-b';other.project.name='Fictional B';other.tasks=[{id:'task-b',name:'Fictional B task',completed:false}];other.gear=[{id:'gear-b',name:'Fictional B light',category:'lighting',status:'check',owner:'Fictional B owner',assignee:''}];state.projects=[other];app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(username,1,JSON.stringify(state));
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
try{
 for(const kind of ['gear','task']){
  const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let armed=false,attempt=0,ready,release;const requests=[];
  await page.route('**/api/**',async route=>{const req=route.request(),matches=kind==='gear'?req.url().endsWith('/equipment/gear-b/assignments'):req.url().endsWith('/api/workspace');if(!armed||req.method()!=='PUT'||!matches)return route.continue();const data=req.postDataJSON();requests.push(data);attempt++;const response=attempt===3?await route.fetch():null;ready();await new Promise(resolve=>release=resolve);if(response)await route.fulfill({response});else await route.fulfill({status:503,contentType:'application/json',body:'{"error":"Fictional transient failure"}'});});
  await page.goto(base+'/?project=fictional-a');await page.getByLabel('사용자 이름',{exact:true}).fill(username);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.locator('#login button[type=submit]').click();await page.locator('[data-view=tasks]').click();await page.locator('[data-project=fictional-b]').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');await page.locator(`[data-view=${kind==='gear'?'gear':'tasks'}]`).click();await page.locator(kind==='gear'?'[data-edit-equipment=gear-b]':'[data-edit-task=task-b]').click();
  const typed=`Fictional retained ${kind} retry`;await page.locator(kind==='gear'?'[data-form=equipment-edit] [name=owner]':'[data-form=task-edit] [name=name]').fill(typed);armed=true;
  let waiting=new Promise(resolve=>ready=resolve);await page.locator(`[data-form=${kind==='gear'?'equipment-edit':'task-edit'}]`).getByRole('button',{name:'변경 사항 저장',exact:true}).click();await waiting;
  await page.goBack();await page.goBack();assert.equal(await page.evaluate(()=>history.state.projectId),'fictional-a');release();await page.locator('[data-action=retry-save]').waitFor();
  waiting=new Promise(resolve=>ready=resolve);await page.locator('[data-action=retry-save]').click();await waiting;await page.goForward();await page.goForward();assert.equal(await page.evaluate(()=>history.state.projectId),'fictional-b');release();await page.locator('[data-action=retry-save]').waitFor();
  waiting=new Promise(resolve=>ready=resolve);await page.locator('[data-action=retry-save]').click();await waiting;await page.goBack();await page.goBack();assert.equal(await page.evaluate(()=>history.state.projectId),'fictional-a');release();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
  assert.equal(parseRoute(page.url()).projectId,'fictional-a');assert.ok((await page.locator('.content').innerText()).includes('Fictional A unchanged'));assert.equal(attempt,3);
  const stored=JSON.parse(app.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get(username).body);const projects=[stored,...stored.projects];assert.equal(projects.find(p=>p.project.id==='fictional-a').tasks[0].name,'Fictional A unchanged');const b=projects.find(p=>p.project.id==='fictional-b');assert.equal(kind==='gear'?b.gear[0].owner:b.tasks[0].name,typed);
  if(kind==='gear')for(const req of requests)assert.equal(req.values.owner,typed);else for(const req of requests)assert.equal([req.state,...req.state.projects].find(p=>p.project.id==='fictional-b').tasks[0].name,typed);
  console.log(`PASS ${kind} B save: pending Back A, failed retry Forward B, second failure, successful retry Back A preserves B intent and A context/data`);await page.close();
 }
 // Project-local IDs may legitimately repeat; a delayed save must not focus another project.
 {
  const current=JSON.parse(app.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get(username).body);for(const project of [current,...current.projects])project.tasks=[{id:'fictional-common-task',name:`Fictional ${project.project.id} common task`,completed:false}];app.db.prepare('UPDATE workspaces SET body=? WHERE user_id=?').run(JSON.stringify(current),username);
  const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let armed=false,ready,release;
  await page.route('**/api/workspace',async route=>{if(!armed||route.request().method()!=='PUT')return route.continue();const response=await route.fetch();ready();await new Promise(resolve=>release=resolve);await route.fulfill({response});});
  await page.goto(base+'/?project=fictional-b');await page.getByLabel('사용자 이름',{exact:true}).fill(username);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.locator('#login button[type=submit]').click();await page.locator('[data-view=tasks]').click();await page.locator('[data-project=fictional-a]').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');await page.locator('[data-view=tasks]').click();
  armed=true;const waiting=new Promise(resolve=>ready=resolve);await page.locator('[data-task=fictional-common-task]').check();await waiting;await page.goBack();await page.goBack();assert.equal(await page.evaluate(()=>history.state.projectId),'fictional-b');release();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
  const focusStolen=await page.locator('[data-task=fictional-common-task]').evaluate(node=>node===document.activeElement);console.log(JSON.stringify({scenario:'same-local-task-id-cross-project-focus',currentProject:'fictional-b',focusStolen}));assert.equal(focusStolen,false,'A save completion focused B task solely because its project-local id matched');await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
