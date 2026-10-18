// Isolated late-render save-lock regression. All account/project records are fictional.
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
const base=`http://127.0.0.1:${port}`,dir=await mkdtemp(join(tmpdir(),'studio-save-lock-')),app=await createApp({dir,origin:base,secure:false});
const username='fictional-save-lock',password='Fictional!Save2026';
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(username,username,await hashPassword(password));
const state=prepareProjects(emptyWorkspace());state.project.name='Fictional baseline';state.members=[{id:'fictional-member',name:'Fictional Crew',role:'Crew',call:''}];
app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(username,1,JSON.stringify(state));
app.db.prepare('INSERT INTO project_teams VALUES(?,?,?,?)').run('fictional-team',username,state.project.id,'Fictional Team');
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
let holdTeams=false,failSave=true,teamPuts=0;const delayed=[];
await page.route('**/api/projects/**/teams',async route=>{if(route.request().method()==='PUT')teamPuts++;if(holdTeams&&route.request().method()==='GET'){delayed.push(route);return;}await route.continue();});
await page.route('**/api/workspace',async route=>{if(route.request().method()==='PUT'&&failSave){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fictional transient failure'})});return;}await route.continue();});
try{
 await page.goto(base);await page.getByLabel('사용자 이름',{exact:true}).fill(username);await page.getByLabel('비밀번호',{exact:true}).fill(password);await page.locator('#login button[type=submit]').click();
 await page.locator('[data-view=project-settings]').click();await page.locator('[data-member-team]').waitFor();await page.locator('#project-name').fill('Fictional retried project');holdTeams=true;
 await page.locator('[data-form=project] > button').click();await page.locator('[data-action=retry-save]').waitFor();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장 실패');
 // Both the saving render and failure render initiated delayed list requests.
 for(let i=0;i<100&&delayed.length<2;i++)await new Promise(r=>setTimeout(r,10));assert.ok(delayed.length>=2);
 holdTeams=false;await Promise.all(delayed.splice(0).map(route=>route.continue()));
 const check=page.locator('[data-member-team]');await check.waitFor();assert.ok(await check.isDisabled());assert.ok(await check.evaluate(node=>node.matches(':disabled')));
 assert.equal(await page.locator('[data-action=retry-save]').isEnabled(),true);
 await check.evaluate(node=>node.click());await page.waitForTimeout(100);assert.equal(teamPuts,0);assert.equal(await check.isChecked(),false);
 assert.equal(await page.locator('#project-name').inputValue(),'Fictional retried project');failSave=false;await page.locator('[data-action=retry-save]').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
 assert.equal(await page.locator('#project-name').inputValue(),'Fictional retried project');await page.locator('[data-member-team]').waitFor();assert.equal(await page.locator('[data-member-team]').isEnabled(),true);
 const saved=JSON.parse(app.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get(username).body);assert.equal(saved.project.name,'Fictional retried project');assert.deepEqual(errors,[]);
 console.log('PASS delayed team GET after failed save: inherited disabled prevents PUT, retry remains enabled, draft preserved, retry persists and unlocks controls');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
