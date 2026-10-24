import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {sharedFixture} from '../tests/helpers/shared-calendar-fixture.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const f=await sharedFixture({port}),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext();await context.addCookies([{url:f.origin,name:'studio_session',value:'owner'}]);const page=await context.newPage();
 const results=[];
 for(const theme of ['light','dark'])for(const [anchor,weeks]of [['2026-02-01',4],['2026-04-01',5],['2026-05-01',6]])for(const height of [700,1000]){
  const row=f.db.prepare('SELECT body FROM workspaces WHERE user_id=?').get('owner'),state=JSON.parse(row.body);
  state.contents=Array.from({length:30},(_,i)=>({...state.contents[0],id:'dense-'+i,name:'Fixture '+i,date:anchor,time:''}));f.db.prepare('UPDATE workspaces SET body=? WHERE user_id=?').run(JSON.stringify(state),'owner');
  await page.setViewportSize({width:1600,height});await page.goto(f.origin+'/owner/project/owner-project/owner-project/schedule');
  await page.evaluate(({anchor,theme})=>{localStorage.setItem('studio.workspaceCalendar.v1:owner:project:owner-project',JSON.stringify({view:'calendar',mode:'month',anchor}));document.documentElement.dataset.theme=theme;},{anchor,theme});await page.reload();
  await page.waitForFunction(()=>document.querySelector('[data-workspace-calendar]')?.dataset.calendarLoading==='false');
  const month=page.locator('.month-calendar');await page.waitForFunction(()=>document.querySelector('.month-calendar')?.style.getPropertyValue('--calendar-month-height'));
  const data=await month.evaluate(n=>{const event=n.querySelector('.calendar-event'),cell=event.closest('.calendar-cell-events'),box=n.getBoundingClientRect();return {weeks:Number(n.style.getPropertyValue('--calendar-weeks')),bottom:box.bottom,height:box.height,font:getComputedStyle(event).fontSize,gap:getComputedStyle(cell).gap,scrollbar:getComputedStyle(cell).scrollbarWidth,scrollable:cell.scrollHeight>cell.clientHeight};});
  assert.equal(data.weeks,weeks);assert.ok(Math.abs(data.bottom-(height-16))<2,JSON.stringify(data));assert.equal(data.font,'13px');assert.equal(data.gap,'2px');assert.equal(data.scrollbar,'none');assert.equal(data.scrollable,true);
  const cell=page.locator('.calendar-cell-events').filter({has:page.locator('.calendar-event')}).first();await cell.focus();await page.keyboard.press('End');await page.waitForTimeout(100);assert.ok(await cell.evaluate(n=>n.scrollTop>0));results.push({theme,weeks,viewport:height,...data});
 }
 console.log(JSON.stringify(results));
}finally{await browser.close();await f.close();}
