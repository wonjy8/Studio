// Isolated team-assignment concurrency QA. No production services or accounts.
// STUDIO_PLAYWRIGHT_MODULE=/tmp/studio-qa/node_modules/playwright/index.mjs node tools/qa-sync-browser.mjs
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {hashPassword} from '../server/auth.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {prepareProjects} from '../src/domain/projects.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const base=`http://127.0.0.1:${port}`,dir=await mkdtemp(join(tmpdir(),'studio-sync-browser-')),app=await createApp({dir,origin:base,secure:false});
const owner='fictional-sync-owner',password='Fictional!Sync2026',pid='fictional-sync-project',members=['fictional-person-one','fictional-person-two'],teams=['fictional-team-a','fictional-team-b'];
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run(owner,owner,await hashPassword(password));
const state=prepareProjects(emptyWorkspace());state.project.id=pid;state.members=members.map((id,index)=>({id,name:`Fictional Person ${index+1}`,role:'Crew',call:''}));
app.db.prepare('INSERT INTO workspaces VALUES(?,?,?)').run(owner,1,JSON.stringify(state));for(const [index,id]of teams.entries())app.db.prepare('INSERT INTO project_teams VALUES(?,?,?,?)').run(id,owner,pid,`Fictional Team ${index?'B':'A'}`);
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[],requests=[],reads=[];page.on('request',r=>{if(r.method()==='GET'&&new RegExp(`/api/projects/${pid}/(teams|members)$`).test(r.url()))reads.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/projects/*/members/*/teams',async route=>{
 if(route.request().method()!=='PUT')return route.continue();
 let release;const gate=new Promise(resolve=>release=resolve),entry={memberId:route.request().url().split('/').at(-2),body:route.request().postDataJSON(),release};requests.push(entry);
 const succeed=await gate;if(succeed){const response=await route.fetch();assert.equal(response.status(),200);await route.fulfill({response});}else await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Fictional injected team save failure'})});
});
const check=(member,team)=>page.locator(`[data-member-team="${members[member]}"][value="${teams[team]}"]`);
const status=member=>page.locator(`[data-team-status="${members[member]}"]`);
const dbTeams=member=>app.db.prepare('SELECT team_id FROM project_team_members WHERE member_id=? ORDER BY team_id').all(members[member]).map(row=>row.team_id);
async function count(n){const deadline=Date.now()+10000;while(requests.length<n&&Date.now()<deadline)await page.waitForTimeout(10);assert.equal(requests.length,n);}
async function reset(initial=[]){app.db.prepare('DELETE FROM project_team_members').run();for(const team of initial)app.db.prepare('INSERT INTO project_team_members VALUES(?,?)').run(teams[team],members[0]);requests.length=0;await page.reload();await page.locator('.production-app').waitFor();await page.locator('[data-view=members]').click();await check(0,0).waitFor();}
async function saved(member){await status(member).filter({hasText:'팀 배정이 저장됐습니다.'}).waitFor();}
try{
 await page.goto(base);await page.locator('[name=username]').fill(owner);await page.locator('[name=password]').fill(password);await page.locator('[type=submit]').click();await page.locator('.production-app').waitFor();
 await reset();await check(0,0).check();await count(1);await check(0,1).check();await page.waitForTimeout(100);assert.equal(requests.length,1,'same member has only one in-flight request');assert.deepEqual(requests[0].body.teamIds,[teams[0]]);requests[0].release(true);await count(2);assert.deepEqual(requests[1].body.teamIds,teams);requests[1].release(true);await saved(0);assert.deepEqual(dbTeams(0),teams);console.log('PASS delayed A then A+B serializes and persists latest selection');
 await reset();await check(0,0).check();await count(1);await check(0,1).check();requests[0].release(false);await count(2);assert.deepEqual(requests[1].body.teamIds,teams);assert.equal(await check(0,0).isChecked(),true);assert.equal(await check(0,1).isChecked(),true);requests[1].release(true);await saved(0);assert.deepEqual(dbTeams(0),teams);console.log('PASS earlier failure preserves newer desired selection and retries latest');
 await reset([0]);await check(0,1).check();await count(1);requests[0].release(false);await status(0).filter({hasText:'마지막 저장 상태로 복원했습니다.'}).waitFor();assert.equal(await check(0,0).isChecked(),true);assert.equal(await check(0,1).isChecked(),false);assert.deepEqual(dbTeams(0),[teams[0]]);console.log('PASS latest failure restores confirmed selection with visible error');
 await reset();await check(0,0).check();await count(1);await check(1,1).check();await count(2);assert.equal(requests[0].memberId,members[0]);assert.equal(requests[1].memberId,members[1]);requests[1].release(true);await saved(1);assert.deepEqual(dbTeams(1),[teams[1]]);assert.deepEqual(dbTeams(0),[]);assert.match(await status(0).innerText(),/저장 중/);requests[0].release(true);await saved(0);assert.deepEqual(dbTeams(0),[teams[0]]);assert.deepEqual(dbTeams(1),[teams[1]]);console.log('PASS different members save independently without a global request lock');
 await reset();await check(0,0).check();await count(1);await check(0,1).check();await page.locator('[data-view=home]').click();reads.length=0;await page.locator('[data-view=members]').click();await page.waitForTimeout(100);assert.equal(reads.length,0,'returning panel waits for existing queue before reading authoritative teams');assert.equal(requests.length,1);requests[0].release(true);await count(2);assert.deepEqual(requests[1].body.teamIds,teams);requests[1].release(true);await check(0,0).waitFor();await page.waitForFunction(({member,team})=>document.querySelector(`[data-member-team="${member}"][value="${team}"]`)?.checked,{member:members[0],team:teams[1]});assert.equal(await check(0,0).isChecked(),true);assert.equal(reads.length,2);assert.deepEqual(dbTeams(0),teams);await check(0,0).uncheck();await count(3);assert.deepEqual(requests[2].body.teamIds,[teams[1]]);requests[2].release(true);await saved(0);assert.equal(await check(0,0).isChecked(),false);assert.equal(await check(0,1).isChecked(),true);assert.deepEqual(dbTeams(0),[teams[1]]);console.log('PASS return to members waits for pending queue before GET and fresh selection stays authoritative');
 await page.reload();await page.locator('.production-app').waitFor();await page.locator('[data-view=members]').click();await check(0,0).waitFor();assert.equal(await check(0,0).isChecked(),false);assert.equal(await check(0,1).isChecked(),true);assert.deepEqual(errors,[]);console.log('PASS reload preserves assignments; no browser exceptions');
}finally{for(const request of requests)request.release(false);await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
