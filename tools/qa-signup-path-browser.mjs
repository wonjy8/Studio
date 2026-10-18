// Fake invitation values and an empty temporary database only.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(join(tmpdir(),'studio-signup-path-'));
const app=await createApp({dir,origin:'http://localhost',secure:false});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const path of ['/signup','/signin']){
  await page.goto(base+path);await page.locator('#signup').waitFor();
  assert.equal(new URL(page.url()).pathname,'/signup');
  assert.equal(await page.locator('#signup button[type=submit]').isDisabled(),true);
  assert.match(await page.locator('#signup-error').innerText(),/초대 링크/);
 }
 const fake='a'.repeat(64);await page.goto(base+'/#invite='+fake);await page.locator('#signup').waitFor();
 assert.equal(new URL(page.url()).pathname,'/signup');assert.equal(new URL(page.url()).hash,'');
 assert.equal(await page.locator('#signup button[type=submit]').isEnabled(),true);
 await page.reload();await page.locator('#signup').waitFor();
 assert.equal(await page.locator('#signup button[type=submit]').isDisabled(),true);
 assert.equal(await page.evaluate(value=>Object.values(localStorage).some(item=>item.includes(value)),fake),false);
 assert.equal(app.db.prepare('SELECT COUNT(*) count FROM users').get().count,0);
 assert.deepEqual(errors,[]);console.log('PASS signup paths, token consumption, safe tokenless reload and no account changes');
}finally{await browser.close();await new Promise(resolve=>app.server.close(resolve));await rm(dir,{recursive:true,force:true});}
