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
 await page.locator('[data-view=camera]').click();await page.locator('[data-action=add-placement]').click();
 const form=page.locator('[data-form=placement]');await form.locator('[name=name]').fill('Fictional colored table');await form.locator('.color-choice').filter({has:page.locator('[value=blue]')}).click();await form.getByRole('button',{name:'종류 선택',exact:true}).click();
 await page.screenshot({path:'/tmp/studio-placement-desktop.png'});assert.equal(await form.locator('.placement-kind-choice svg[fill="currentColor"][stroke=none]').count(),7);
 await form.locator('[name=kind][value=table]').check();assert.equal(await form.locator('[name=name]').inputValue(),'Fictional colored table');assert.equal(await form.locator('[name=color]:checked').inputValue(),'blue');
 assert.equal(await form.locator('[popover]').isVisible(),false);await form.locator('[name=shape]').selectOption('circle');await form.locator('button.primary').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');
 await page.reload();await page.locator('[data-view=camera]').click();const table=page.locator('.layout-table');await table.waitFor();assert.ok(await table.evaluate(e=>getComputedStyle(e).getPropertyValue('--layout-color').trim()===getComputedStyle(e).getPropertyValue('--blue').trim()));
 await table.focus();await page.keyboard.press('Enter');const position=page.locator('[data-form=position]');assert.equal(await position.locator('[name=color]:checked').inputValue(),'blue');await position.locator('.color-choice').filter({has:page.locator('[value=rose]')}).click();await position.locator('button.primary').click();await page.waitForFunction(()=>document.querySelector('.save-indicator')?.textContent==='저장됨');await page.reload();await page.locator('[data-view=camera]').click();
 const payload=await (await page.request.get(base+'/api/workspace')).json();assert.equal(payload.state.layoutObjects[0].color,'rose');
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action=add-placement]').click();const mobile=page.locator('[data-form=placement]');await mobile.getByRole('button',{name:'종류 선택',exact:true}).click();await page.screenshot({path:'/tmp/studio-placement-mobile.png'});assert.ok(await mobile.locator('[popover]').evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.locator('[name=kind]:checked').focus();await page.keyboard.press('Escape');assert.equal(await mobile.isVisible(),true);assert.equal(await mobile.locator('[popover]').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS placement filled icons, color creation/edit/reload, kind draft preservation, mobile bounds/Escape, teams only in members');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
