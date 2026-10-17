// Optional isolated browser acceptance suite. Install Playwright separately and set
// STUDIO_PLAYWRIGHT_MODULE to its index.mjs when it is outside this checkout.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'studio-browser-'));
const app=await createApp({dir,origin:'http://localhost',secure:false});
const password='Fictional!Qa2026';
for(const id of ['qa-owner','qa-member','qa-outsider'])app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,await hashPassword(password));
app.db.prepare("INSERT OR REPLACE INTO site_settings VALUES('admin_user_id',?)").run('qa-owner');
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`;
// Test only: browser Origin must match the local fixture's configured origin.
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/api/**',route=>route.continue({headers:{...route.request().headers(),origin:'http://localhost'}}));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const settled=()=>page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
const go=async view=>{await page.locator(`[data-view="${view}"]`).first().click();};
const login=async(p,username)=>{await p.goto(base);await p.locator('[name=username]').fill(username);await p.locator('[name=password]').fill(password);await p.locator('[type=submit]').click();await p.locator('.production-app').waitFor();};
try {
 await login(page,'qa-owner');
 assert.match(await page.locator('body').innerText(),/촬영과 장비를 추가/);console.log('PASS empty readiness');
 const production=await page.locator('[data-action=production] svg').evaluate(x=>x.outerHTML);await go('settings');assert.equal(await page.locator('[data-action=production] svg').evaluate(x=>x.outerHTML),production);assert.equal(await page.locator('.project-sidebar [data-project]').count(),0);console.log('PASS stable production/settings sidebar');
 await page.locator('[data-action=production]').click();await go('contents');await page.locator('[data-action=add-content]').first().click();
 for(const [label,value]of [['촬영 이름','Fictional keyboard shoot'],['시간','10:00–11:00'],['장소','Fictional stage']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.locator('[data-form=content] button').click();await settled();const card=page.locator('[data-content]').first();await card.focus();await page.keyboard.press('Enter');await page.locator('[role=dialog]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[role=dialog]').count(),0);assert.equal(await page.locator('[data-content]').first().evaluate(x=>x===document.activeElement),true);console.log('PASS shoot labels, keyboard, Escape focus');
 await go('schedule');await page.locator('[data-action=schedule-calendar]').click();assert.equal(await page.locator('.schedule-calendar').count(),1);await page.locator('[data-action=schedule-list]').click();assert.match(await page.locator('.content').innerText(),/Fictional keyboard shoot/);console.log('PASS schedule views');
 await go('tasks');await page.getByLabel('할 일',{exact:true}).fill('Fictional checklist');await page.locator('[data-form=task] button').click();await settled();await page.locator('[data-task]').check();await settled();assert.equal(await page.locator('[data-task]').isChecked(),true);console.log('PASS checklist');
 await go('camera');await page.locator('[data-action=add-placement]').click();await page.getByLabel('이름',{exact:true}).fill('Fictional table');await page.locator('[name=kind][value=table]').check();assert.equal(await page.getByLabel('이름',{exact:true}).inputValue(),'Fictional table');await page.locator('[data-form=placement] button').click();await settled();assert.equal(await page.locator('[data-resize]').count(),8);
 const table=page.locator('[data-layout-id]').first(),before=await table.boundingBox(),edge=await page.locator('[data-resize=e]').boundingBox();await page.mouse.move(edge.x+edge.width/2,edge.y+edge.height/2);await page.mouse.down();await page.mouse.move(edge.x+edge.width/2+50,edge.y+edge.height/2,{steps:8});await page.mouse.up();await settled();assert.ok((await table.boundingBox()).width>before.width+35);console.log('PASS table drag + preserved form draft');
 await go('project-settings');await page.getByLabel('프로젝트 이름',{exact:true}).fill('Fictional project '+ 'Long '.repeat(25));await page.getByLabel('설명',{exact:true}).fill('Fictional description');await page.getByLabel('아이콘 검색',{exact:true}).fill('카카오');await page.locator('[data-icon-option]').first().check();await page.getByLabel('아이콘 검색',{exact:true}).fill('no-such-icon');await page.locator('[data-form=project] button[type=submit], [data-form=project] button.primary').last().click();await settled();await page.reload();await page.locator('.production-app').waitFor();await go('project-settings');assert.equal(await page.locator('[data-form=project] [name=icon]').inputValue(),'brand-kakaotalk');console.log('PASS icon search selection/save/reload');
 assert.equal(await page.locator('.project-sidebar').evaluate(x=>x.scrollWidth<=x.clientWidth),true);console.log('PASS long project sidebar');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS browser exceptions absent');
} finally {await browser.close();await new Promise(r=>app.server.close(r));app.db.close();await rm(dir,{recursive:true,force:true});}
