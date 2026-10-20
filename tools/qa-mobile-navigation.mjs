// Isolated mobile navigation QA. All accounts and production content are fictional.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects} from '../src/domain/projects.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const origin='http://127.0.0.1:'+port,dir=await mkdtemp('/tmp/studio-mobile-nav-'),app=await createApp({dir,origin,secure:false}),password='Fictional!Mobile2026';
for(const id of ['mobile-owner','mobile-member']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,id,await hashPassword(password));const state=prepareProjects(emptyWorkspace());state.project.name='Fictional project';state.project.description='Fictional mobile navigation';app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(id,1,JSON.stringify(state));}
app.db.prepare("INSERT OR REPLACE INTO site_settings VALUES('admin_user_id','mobile-owner')").run();
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.locator('[name=username]').fill('mobile-owner');await page.locator('[name=password]').fill(password);await page.locator('#login [type=submit]').click();await page.locator('.workspace-rail').waitFor();
 const rail=page.locator('.workspace-rail'),panel=page.locator('.project-sidebar'),main=page.locator('.main');
 await rail.locator('[data-action=production]').click();await panel.waitFor({state:'visible'});assert.equal(await main.evaluate(n=>n.inert),true);
 const listURL=page.url();await panel.locator('[data-project=project-main]').click();await panel.waitFor({state:'hidden'});assert.equal(await main.evaluate(n=>n.inert),false);
 await page.goBack();await panel.waitFor({state:'visible'});assert.equal(page.url(),listURL);await page.goForward();await panel.waitFor({state:'hidden'});
 const deep=page.url();await page.reload();await page.locator('.workspace-rail').waitFor();assert.equal(await panel.isVisible(),false);assert.equal(page.url(),deep);
 await page.locator('.project-tabs [data-view=project-settings]').click();await page.locator('#project-name').fill('Retained fictional draft');await page.locator('#project-name').evaluate(n=>n.mobileSentinel='kept');
 const draftURL=page.url();await page.locator('.sidebar-toggle').click();await panel.waitFor({state:'visible'});assert.equal(page.url(),draftURL);await page.goBack();await panel.waitFor({state:'hidden'});assert.equal(await page.locator('#project-name').inputValue(),'Retained fictional draft');assert.equal(await page.locator('#project-name').evaluate(n=>n.mobileSentinel),'kept');
 // Discard only the fictional unsaved field before navigating to another feature.
 await page.locator('#project-name').fill('Fictional project');
 await rail.locator('[data-view=member-equipment]').click();await panel.waitFor({state:'visible'});await page.screenshot({path:'/tmp/studio-mobile-navigation-list.png'});await panel.locator('[data-view=equipment-catalog]').click();await panel.waitFor({state:'hidden'});assert.match(page.url(),/inventory\/catalog/);
 await page.locator('.sidebar-toggle').click();await panel.waitFor({state:'visible'});assert.equal(await panel.locator('[data-view=equipment-catalog]').getAttribute('aria-current'),'page');await panel.locator('.mobile-close').click();await panel.waitFor({state:'hidden'});
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});const box=await rail.boundingBox();assert.ok(box.x>=10&&box.y+box.height<=834,'floating gutters');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');assert.ok(await rail.locator('.rail-button').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().width>=44&&n.getBoundingClientRect().height>=44)));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/studio-mobile-floating-navigation.png'});
 await rail.locator('[data-view=settings]').click();await panel.waitFor({state:'visible'});await panel.locator('[data-settings-section=account]').click();await panel.waitFor({state:'hidden'});
 // Simulate a visual viewport shrink independently of layout width, as an IME does.
 await page.evaluate(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:new EventTarget()});Object.defineProperty(window.visualViewport,'height',{configurable:true,value:844});});
 await page.locator('[data-edit-name]').click();const input=page.locator('[data-account-profile] input[name=name]');await input.focus();await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:440});window.dispatchEvent(new Event('resize'));});assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('mobile-keyboard-open')),true);assert.equal(await rail.evaluate(n=>n.inert),true);
 await input.blur();await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:844});window.dispatchEvent(new Event('resize'));});
 await page.setViewportSize({width:1440,height:1000});assert.equal(await panel.isVisible(),true);assert.ok((await rail.boundingBox()).height>900);assert.equal(await main.evaluate(n=>n.inert),false);
 const member=await browser.newPage({viewport:{width:320,height:568}});await member.goto(origin);await member.locator('[name=username]').fill('mobile-member');await member.locator('[name=password]').fill(password);await member.locator('#login [type=submit]').click();await member.locator('.workspace-rail').waitFor();assert.equal(await member.locator('.workspace-rail [data-view=admin]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: floating mobile navigation, list/detail history, direct links, retained drafts, selected items, 320/390/768 widths, IME handling, desktop and permission menus');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
