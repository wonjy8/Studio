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
 assert.equal(await page.locator('[data-view=contents]').count(),0);await page.locator('[data-view=schedule]').click();await page.locator('[data-action=schedule-list]').click();await page.locator('[data-action=add-content]').click();const shoot=page.locator('[data-form=content]');await shoot.locator('[name=name]').fill('Unified shoot');await shoot.locator('[name=time]').fill('10:00');await shoot.locator('[name=location]').fill('QA stage');await shoot.locator('button.primary').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');await page.locator('.content [data-content]').first().click();await page.locator('[data-form=content-edit]').waitFor();assert.equal(await page.locator('[data-script-file]').count(),1);await page.keyboard.press('Escape');
 await page.locator('[data-view=camera]').click();const settled=()=>page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
 await page.locator('[data-action=add-line]').click();await page.locator('[data-form=placement] button.primary').click();await settled();await page.locator('.layout-arrow').waitFor();
 await page.locator('[data-action=add-line]').click();await page.locator('[data-layout-preview]').click();await page.locator('[data-placement-kind][value=line]').check();await page.locator('[data-form=placement] button.primary').click();await settled();await page.locator('.layout-line').waitFor();assert.equal(await page.locator('.layout-line').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.locator('.layout-arrow').focus();await page.keyboard.press('Enter');const position=page.locator('[data-form=position]');await position.locator('[name=width]').fill('240');await position.locator('[name=rotation]').fill('90');await position.locator('button.primary').click();await settled();
 await page.locator('[data-action=add-text]').click();const form=page.locator('[data-form=placement]');await form.locator('[name=name]').fill('배경 텍스트');assert.equal(await form.locator('[name=background]').inputValue(),'transparent');await form.locator('[data-text-transparent]').uncheck();await form.locator('[data-text-background]').fill('#e9e5ff');await form.locator('button.primary').click();await settled();await page.reload();await page.locator('[data-view=camera]').click();const text=page.locator('.layout-text');assert.equal(await text.evaluate(e=>getComputedStyle(e).borderRadius),'8px');assert.equal(await text.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(233, 229, 255)');await text.click();assert.equal(await text.evaluate(e=>getComputedStyle(e).borderRadius),'8px');
 const payload=await (await page.request.get(base+'/api/workspace')).json();const arrow=payload.state.layoutObjects.find(x=>x.kind==='arrow');assert.equal(arrow.width,240);assert.equal(arrow.rotation,90);assert.equal(payload.state.layoutObjects.find(x=>x.kind==='text').background,'#e9e5ff');
 await page.screenshot({path:'/tmp/studio-shapes-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('[data-action=add-text]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/studio-shapes-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS unified schedule/details/scripts, line/arrow placement and size/rotation persistence, rounded text color and mobile bounds');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
