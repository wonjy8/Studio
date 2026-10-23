// Local fictional accounts, generated documents/ZIP only. No external providers.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {newDocument} from '../src/domain/documents.js';
import {fixtureZip} from './qa-scripture-fixtures.mjs';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const origin='http://127.0.0.1:'+port,dir=await mkdtemp('/tmp/studio-compute-browser-'),app=await createApp({dir,origin,secure:false});
for(const uid of ['fixture-a','fixture-b']){app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(uid,uid,'unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(uid),uid,Date.now()+600000);}
const docs=Array.from({length:130},(_,i)=>{const doc=newDocument('Record'+String(i).padStart(3,'0'));doc.blocks[0].content=[{text:'Private A 한글 keyword'+i}];return doc;});app.db.prepare('INSERT INTO document_library VALUES(?,?,1)').run('fixture-a',JSON.stringify(docs));
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(10000);await page.context().addCookies([{name:'studio_session',value:'fixture-a',url:origin}]);
 await page.goto(origin+'/fixture-a/dataspace/materials');await page.waitForFunction(()=>document.querySelectorAll('[data-material-card]').length===60);
 assert.equal(await page.evaluate(async()=>Boolean((await import('/src/compute/runtime.js')).computeEngine)),true);
 await page.locator('[data-material-page-next]').click();assert.equal(await page.locator('[data-material-card]').count(),60);await page.locator('[data-material-page-next]').click();assert.equal(await page.locator('[data-material-card]').count(),10);assert.equal(await page.locator('[data-material-page-next]').isDisabled(),true);
 await page.locator('[data-material-search]').fill('keyword129');assert.equal(await page.locator('[data-material-card]').count(),1);assert.match(await page.locator('[data-material-card]').innerText(),/Record129/);
 await page.locator('[data-material-search]').fill('한글');assert.equal(await page.locator('[data-material-card]').count(),60);await page.locator('[data-material-page-next]').click();assert.equal(await page.locator('[data-material-card]').count(),60);
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 // Navigate within the same document: the detached Materials index disposes.
 await page.locator('[data-view=scripture]').click();await page.locator('[data-scripture-import]').waitFor({state:'attached'});
 let intercepted;const started=new Promise(r=>intercepted=r);await page.route('**/api/scripture/import?preview=1',async route=>{intercepted();await new Promise(r=>setTimeout(r,500));try{await route.abort();}catch{}});
 const zip={name:'fixture.zip',mimeType:'application/zip',buffer:fixtureZip({'성경.csv':'구절,구약·신약,본문,성경,장,절\n창세기 1:1,구약,Fixture first,창세기,1,1\n'})};
 await page.locator('[data-scripture-import]').setInputFiles(zip);await started;await page.locator('[data-scripture-import-cancel]').click();await page.getByText(/가져오기 요청을 취소했습니다/).waitFor();assert.equal(app.db.prepare('SELECT count(*) n FROM scripture_verses').get().n,0);
 await page.unroute('**/api/scripture/import?preview=1');await page.locator('[data-scripture-import]').setInputFiles(zip);await page.waitForFunction(()=>document.querySelector('[data-scripture-status]')?.textContent.includes('1개 구절을'));assert.equal(app.db.prepare('SELECT count(*) n FROM scripture_verses').get().n,1);
 await page.context().addCookies([{name:'studio_session',value:'fixture-b',url:origin}]);await page.goto(origin+'/fixture-b/dataspace/materials');await page.getByText('조건에 맞는 자료가 없습니다.',{exact:true}).waitFor();await page.locator('[data-material-search]').fill('Private A');assert.equal(await page.locator('[data-material-card]').count(),0);
 await page.screenshot({path:'/tmp/studio-compute-materials.png'});assert.deepEqual(errors,[]);console.log('PASS Rust active, bounded Materials pages/search/mobile, ZIP cancel and retry/import, account isolation');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
