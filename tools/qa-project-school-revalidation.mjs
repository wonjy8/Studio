// Fictional local account only. No live NAS or Google calls.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {emptySchool} from '../src/domain/school.js';
import {newDocument} from '../src/domain/documents.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const origin='http://127.0.0.1:'+port,dir=await mkdtemp('/tmp/studio-doc-revalidation-'),app=await createApp({dir,origin,secure:false});
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','unused');
app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest('fixture-session'),'fictional-owner',Date.now()+600000);
const doc=newDocument('Fictional project document'),state=emptyWorkspace();state.project.id='fixture-project';state.project.name='Fixture';state.documents=[doc];
app.db.prepare('INSERT INTO workspaces(user_id,body,revision) VALUES(?,?,1)').run('fictional-owner',JSON.stringify(state));
const schoolDoc=newDocument('Fictional school document'),school=emptySchool();school.semesters=[{id:'fixture-term',name:'Fixture term'}];school.courses=[{id:'fixture-course',semesterId:'fixture-term',name:'Fixture course',credits:3,status:'planned',creditGroup:'',documents:[schoolDoc],tasks:[],events:[],page:{version:1,syllabusId:'fixture-syllabus',entries:[{id:'fixture-entry',kind:'note',documentId:schoolDoc.id,title:'Fixture note',archived:false,width:100}]}}];
app.db.prepare('INSERT INTO school_workspaces VALUES(?,?,1)').run('fictional-owner',JSON.stringify(school));
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.context().addCookies([{name:'studio_session',value:'fixture-session',url:origin}]);
 await page.goto(origin+'/fictional-owner/project/fixture/fixture-project/home');await page.locator('[data-view="references"]').first().waitFor();
 doc.blocks[0].content=[{text:'Project refreshed remotely',bold:true}];state.project.location='Remote location preserved';
 app.db.prepare('UPDATE workspaces SET body=?,revision=2 WHERE user_id=?').run(JSON.stringify(state),'fictional-owner');
 await page.locator('[data-view="references"]').first().click();await page.locator('[data-editable]').first().waitFor();assert.equal(await page.locator('[data-editable]').first().innerText(),'Project refreshed remotely');
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/workspace')&&r.request().method()==='PUT');await page.locator('[data-editable]').first().fill('Project edit');assert.equal((await saved).status(),200);const stored=JSON.parse(app.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get('fictional-owner').body);assert.equal(stored.project.location,'Remote location preserved');
 app.db.prepare('UPDATE workspaces SET revision=revision+1 WHERE user_id=?').run('fictional-owner');const conflict=page.waitForResponse(r=>r.url().endsWith('/api/workspace')&&r.request().method()==='PUT');await page.locator('[data-editable]').first().fill('Keep project draft');assert.equal((await conflict).status(),409);assert.equal(await page.locator('[data-editable]').first().innerText(),'Keep project draft');
 // Separate page: never bypass a draft navigation guard in the application.
 const schoolPage=await browser.newPage();schoolPage.on('pageerror',e=>errors.push(e.message));await schoolPage.context().addCookies([{name:'studio_session',value:'fixture-session',url:origin}]);
 await schoolPage.goto(origin+'/fictional-owner/school/semesters?semester=fixture-term&course=fixture-course');await schoolPage.locator('[data-school-note]').first().waitFor();
 schoolDoc.blocks[0].content=[{text:'School refreshed remotely',italic:true}];app.db.prepare('UPDATE school_workspaces SET body=?,revision=2 WHERE user_id=?').run(JSON.stringify(school),'fictional-owner');
 await schoolPage.locator('[data-school-note="'+schoolDoc.id+'"]').click();await schoolPage.locator('[data-editable]').first().waitFor();assert.equal(await schoolPage.locator('[data-editable]').first().innerText(),'School refreshed remotely');
 app.db.prepare('UPDATE school_workspaces SET revision=3 WHERE user_id=?').run('fictional-owner');const schoolConflict=schoolPage.waitForResponse(r=>r.url().endsWith('/api/school')&&r.request().method()==='PUT');await schoolPage.locator('[data-editable]').first().fill('Keep school draft');assert.equal((await schoolConflict).status(),409);assert.equal(await schoolPage.locator('[data-editable]').first().innerText(),'Keep school draft');
 assert.deepEqual(errors,[]);console.log('PASS: project and school entry refresh remote rich text; full workspace adoption preserves other fields; real 409 retains both drafts');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
