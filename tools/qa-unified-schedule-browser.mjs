// Isolated visual/interaction smoke test. No production accounts or network calls.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {createServer} from 'node:net';
import {hashPassword} from '../server/auth.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));const base='http://127.0.0.1:'+port;
const dir=await mkdtemp('/tmp/studio-appearance-'),app=await createApp({dir,origin:base,secure:false});
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('appearance','appearance',await hashPassword('Fictional!Qa2026'));
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('[name=username]').fill('appearance');await page.locator('[name=password]').fill('Fictional!Qa2026');await page.locator('#login button[type=submit]').click();await page.locator('[data-view=project-settings]').click();assert.equal(await page.locator('[data-member-accounts]').count(),0);
 await page.locator('[data-view=members]').click();await page.locator('[data-member-accounts]').waitFor();assert.equal(await page.locator('[data-team-create]').count(),1);
 const saved=()=>page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');const tabs=await page.locator('.project-tabs [data-view]').evaluateAll(es=>es.map(e=>e.dataset.view));assert.equal(tabs[tabs.indexOf('schedule')+1],'tasks');await page.locator('[data-view=tasks]').click();const form=page.locator('[data-form=task]');await form.locator('[name=name]').fill('Separate task');await form.locator('button[type=submit]').click();await saved();await page.locator('[data-form=task] [name=name]').fill('Retained task draft');
 await page.locator('[data-view=schedule]').click();assert.equal(await page.locator('[data-form=task]').count(),0);assert.equal(await page.locator('[data-task-row]').count(),0);const selectors=['.schedule-page>.hero','.calendar-toolbar','[data-action=add-content]','[data-action=schedule-list]','[data-action=schedule-calendar]','[data-calendar-month]'];
 for(const width of [1440,1100,390]){await page.setViewportSize({width,height:1000});await page.locator('[data-action=schedule-list]').click();const before=await Promise.all(selectors.map(s=>page.locator(s).boundingBox()));await page.locator('[data-action=schedule-calendar]').click();const after=await Promise.all(selectors.map(s=>page.locator(s).boundingBox()));for(let i=0;i<before.length;i++)for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[i][key]-after[i][key])<1,`${width} ${selectors[i]} ${key}`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.locator('[data-view=tasks]').click();assert.equal(await page.locator('[data-form=task] [name=name]').inputValue(),'Retained task draft');const task=page.locator('[data-task-row]'),id=await task.getAttribute('data-task-row');await task.locator('[data-task]').check();await saved();await page.reload();await page.locator('[data-task-row]').waitFor();assert.equal(await page.locator('[data-task]').isChecked(),true);await page.goto(base+'/projects/project-main/old/tasks/dialog/task-edit/'+id);await page.locator('[data-form=task-edit]').waitFor();assert.equal(await page.locator('[data-view=tasks]').getAttribute('aria-current'),'page');
 assert.deepEqual(errors,[]);console.log('PASS separate task tab beside schedule, stable schedule toolbar across desktop/tablet/mobile, task draft/completion/reload and direct dialogs');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
