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
 await page.locator('[data-view=camera]').click();await page.locator('[data-action=add-light]').click();
 const form=page.locator('[data-form=placement]');await form.locator('[name=lightType]').selectOption('octabox');await form.locator('[name=name]').fill('QA octabox');await form.locator('button.primary').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
 const light=page.locator('.layout-lighting');await light.waitFor();assert.match(await light.textContent(),/팔각 소프트박스/);
 await light.focus();await page.keyboard.press('Enter');await page.locator('[data-form=position] [name=lightType]').selectOption('tube');await page.locator('[data-form=position] button.primary').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
 await page.reload();await page.locator('[data-view=camera]').click();assert.match(await page.locator('.layout-lighting').textContent(),/튜브 조명/);
 await page.locator('.layout-lighting').click();assert.ok(await page.locator('.layout-lighting [data-rotate=ne]').evaluate(e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.borderWidth==='0px'&&!e.textContent;}));
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action=add-light]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const payload=await (await page.request.get(base+'/api/workspace')).json();assert.equal(payload.state.layoutObjects[0].lightType,'tube');assert.equal(payload.state.gear.filter(g=>g.category==='lighting').length,1);
 assert.deepEqual(errors,[]);console.log('PASS lighting creation, subtype edit/reload, inventory link, hidden rotation handles and mobile bounds');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
