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
 await page.goto(base);await page.locator('[name=username]').fill('appearance');await page.locator('[name=password]').fill('Fictional!Qa2026');await page.locator('#login button[type=submit]').click();await page.locator('[data-view=project-settings]').click();
 const trigger=page.getByRole('button',{name:'아이콘 선택',exact:true}),popup=page.locator('#project-icon-popover');
 assert.equal(await popup.isVisible(),false);await page.locator('.color-choice').filter({has:page.locator('[value=blue]')}).click();await trigger.click();await popup.waitFor({state:'visible'});
 for(const svg of await page.locator('[data-icon-results] svg').all()){assert.equal(await svg.getAttribute('fill'),'currentColor');assert.equal(await svg.getAttribute('stroke'),'none');}
 await page.screenshot({path:'/tmp/studio-project-appearance-desktop.png'});
 await page.getByLabel('아이콘 검색',{exact:true}).fill('카카오');await page.locator('[name=project-icon-choice]').first().check();assert.equal(await popup.isVisible(),false);assert.equal(await page.locator('[name=icon]').inputValue(),'brand-kakaotalk');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
 await page.locator('[data-form=project] > button').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');await page.reload();await page.locator('[data-view=project-settings]').click();assert.equal(await page.locator('[name=icon]').inputValue(),'brand-kakaotalk');assert.equal(await page.locator('[name=color]:checked').inputValue(),'blue');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await trigger.click();await popup.waitFor({state:'visible'});assert.ok(await popup.evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/studio-project-appearance-'+width+'.png'});await page.getByLabel('아이콘 검색',{exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await popup.isVisible(),false);}
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-action=add-project]').click();const dialog=page.locator('[role=dialog]');await dialog.getByRole('button',{name:'아이콘 선택',exact:true}).click();await dialog.getByLabel('아이콘 검색',{exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);await dialog.getByRole('button',{name:'아이콘 선택',exact:true}).click();await dialog.locator('[name=project-icon-choice]').nth(1).focus();await page.keyboard.press('Space');assert.equal(await dialog.locator('[name=icon]').inputValue(),'play');assert.equal(await dialog.locator('[popover]').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS filled choices, compact desktop/mobile popover, color and icon persistence, keyboard selection, Escape preserves dialog, no overflow or browser errors');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
