// Isolated fictional account. Appearance changes must never mutate workspace data.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects} from '../src/domain/projects.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const origin='http://127.0.0.1:'+port,dir=await mkdtemp('/tmp/studio-theme-'),app=await createApp({dir,origin,secure:false}),password='Fictional!Theme2026';
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('theme-owner','theme-owner',await hashPassword(password));
const state=prepareProjects(emptyWorkspace());state.project.name='Fictional Theme Project';app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run('theme-owner',1,JSON.stringify(state));
const before=app.db.prepare('SELECT * FROM workspaces WHERE user_id=?').get('theme-owner');
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.locator('[name=username]').fill('theme-owner');await page.locator('[name=password]').fill(password);await page.locator('#login [type=submit]').click();await page.locator('.workspace-rail').waitFor();
 const settings=async()=>{await page.locator('.workspace-rail [data-view=settings]').click();await page.locator('[data-theme-select]').waitFor();};
 await settings();await page.locator('[data-theme-select]').selectOption('dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('meta[name=theme-color]').getAttribute('content'),'#111113');
 const surfaces=async()=>{for(const selector of ['body','.project-header','.project-sidebar','.workspace-rail']){const rgb=await page.locator(selector).evaluate(node=>getComputedStyle(node).backgroundColor);const channels=rgb.match(/[\d.]+/g).slice(0,3).map(Number);assert.ok(channels.every(n=>n<65),selector+': '+rgb);}};
 await surfaces();await page.screenshot({path:'/tmp/studio-theme-settings.png'});
 for(const view of ['workspace-home','materials','member-equipment','scripture','admin']){await page.locator(`.workspace-rail [data-view=${view}]`).click();await surfaces();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');if(view==='workspace-home')await page.screenshot({path:'/tmp/studio-theme-home-dark.png'});}
 await page.locator('.workspace-rail [data-action=production]').click();await page.locator('[data-action=add-project]').click();await page.locator('.modal').waitFor();const modalColor=await page.locator('.modal').evaluate(node=>getComputedStyle(node).backgroundColor);assert.ok(modalColor.match(/[\d.]+/g).slice(0,3).map(Number).every(n=>n<65),modalColor);await page.keyboard.press('Escape');
 await page.reload();await page.locator('.workspace-rail').waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await surfaces();
 const other=await context.newPage();await other.goto(origin+'/theme-owner/dashboard');await other.locator('.home-command').waitFor();assert.equal(await other.locator('html').getAttribute('data-theme'),'dark');
 await settings();await page.locator('[data-theme-select]').selectOption('light');await other.waitForFunction(()=>document.documentElement.dataset.theme==='light');await other.screenshot({path:'/tmp/studio-theme-home-light.png'});await page.reload();await page.locator('[data-theme-select]').waitFor();assert.equal(await page.locator('[data-theme-select]').inputValue(),'light');
 await page.locator('[data-theme-select]').selectOption('dark');await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/studio-theme-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>localStorage.setItem('studio.theme.v1','invalid'));await page.reload();await page.locator('[data-theme-select]').waitFor();assert.equal(await page.locator('[data-theme-select]').inputValue(),'light');
 assert.deepEqual(app.db.prepare('SELECT * FROM workspaces WHERE user_id=?').get('theme-owner'),before);assert.deepEqual(errors,[]);
 console.log('PASS light default despite dark OS, global dark surfaces and settings, reload persistence, live cross-tab sync, reset invalid values, mobile fit and no workspace mutation');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
