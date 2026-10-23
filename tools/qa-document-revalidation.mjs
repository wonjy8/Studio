// Fictional local account only. No live NAS or Google calls.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {newDocument} from '../src/domain/documents.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp('/tmp/studio-doc-revalidation-'),app=await createApp({dir,origin:'http://localhost',secure:false});
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','unused');
app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest('fixture-session'),'fictional-owner',Date.now()+600000);
const doc=newDocument('Fictional document');
app.db.prepare('INSERT INTO document_library VALUES(?,?,1)').run('fictional-owner',JSON.stringify([doc]));
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+app.server.address().port,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.context().addCookies([{name:'studio_session',value:'fixture-session',url:origin}]);
 await page.goto(origin+'/fictional-owner/documents');await page.locator('[data-document-open]').waitFor();
 doc.blocks[0].content=[{text:'Updated remotely',bold:true}];
 app.db.prepare('UPDATE document_library SET body=?,revision=2 WHERE user_id=?').run(JSON.stringify([doc]),'fictional-owner');
 let fail=true;await page.route('**/api/document-library',route=>{if(fail&&route.request().method()==='GET'){fail=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fictional outage'})});}return route.continue();});
 await page.locator('[data-document-open]').click();await page.getByText(/최신 내용을 확인하지 못했습니다/).waitFor();assert.equal(await page.locator('[data-editable]').count(),0);
 await page.locator('[data-document-open]').click();await page.locator('[data-editable]').first().waitFor();assert.equal(await page.locator('[data-editable]').first().innerText(),'Updated remotely');assert.equal(await page.locator('[data-editable] strong').count(),1);
 app.db.prepare('UPDATE document_library SET revision=3 WHERE user_id=?').run('fictional-owner');
 await page.locator('[data-editable]').first().fill('Keep my unsaved draft');await page.locator('[data-document-retry]:visible').waitFor();assert.equal(await page.locator('[data-editable]').first().innerText(),'Keep my unsaved draft');
 assert.deepEqual(errors,[]);console.log('PASS: open revalidates remote rich text, failed open stays closed, conflict preserves local draft');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
