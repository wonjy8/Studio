// Isolated synthetic account and temporary browser profiles; no live account is used.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const dir=await mkdtemp('/tmp/remember-login-browser-'),origin='http://127.0.0.1:'+port,password='Fictional!BrowserRemember2026',app=await createApp({dir:dir+'/data',origin,secure:false});
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('fixture','fixture',await hashPassword(password));await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
let context;const errors=[];
const launch=async profile=>{const ctx=await chromium.launchPersistentContext(profile,{executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox'],viewport:{width:1440,height:900}});ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return ctx;};
try{
 for(const remember of [false,true]){
  const profile=dir+'/profile-'+remember;context=await launch(profile);let page=await context.newPage();await page.goto(origin+'/login');const checkbox=page.getByRole('checkbox',{name:'로그인 유지',exact:true});await checkbox.waitFor();assert.equal(await checkbox.isChecked(),false);
  for(const theme of ['light','dark'])for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await checkbox.focus();await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),true);await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  if(remember)await checkbox.check();await page.locator('#login-username').fill('fixture');await page.locator('#login-password').fill(password);await page.getByRole('button',{name:'로그인',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#login'));
  const cookie=(await context.cookies(origin)).find(c=>c.name==='studio_session');assert.ok(cookie?.httpOnly);assert.equal(cookie.sameSite,'Strict');assert.equal(remember?cookie.expires>Date.now()/1000+29*86400:cookie.expires===-1,true);
  assert.equal(await page.evaluate(({raw,password})=>document.cookie.includes(raw)||JSON.stringify(localStorage).includes(raw)||JSON.stringify(localStorage).includes(password),{raw:cookie.value,password}),false);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#login'));assert.equal((await context.request.get(origin+'/api/session')).status(),200);
  await context.close();context=await launch(profile);page=await context.newPage();await page.goto(origin+'/login');
  if(remember){await page.waitForFunction(()=>!document.querySelector('#login'));assert.equal((await context.request.get(origin+'/api/session')).status(),200);assert.equal((await context.request.post(origin+'/api/logout',{headers:{Origin:origin}})).status(),200);await page.reload();await page.locator('#login').waitFor();assert.equal(await page.getByRole('checkbox',{name:'로그인 유지',exact:true}).isChecked(),false);}
  else{const restored=(await context.cookies(origin)).find(cookie=>cookie.name==='studio_session');if(restored){assert.equal(restored.expires,-1);await page.waitForFunction(()=>!document.querySelector('#login'));assert.equal((await context.request.get(origin+'/api/session')).status(),200);}else{await page.locator('#login').waitFor();assert.equal((await context.request.get(origin+'/api/session')).status(),401);}console.log('Unchecked session cookie restored by Chromium profile: '+Boolean(restored));}
  await context.close();context=null;
 }
 assert.deepEqual(errors,[]);console.log('PASS default unchecked, keyboard/light-dark1440/390/320, HttpOnly/no credential storage, reload, real Chromium profile restart persistent versus session cookie, logout');
}finally{await context?.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
