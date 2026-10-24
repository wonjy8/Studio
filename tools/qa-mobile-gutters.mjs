// Temporary fictional account; compare the previous shared gutters with this CSS.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {sharedFixture} from '../tests/helpers/shared-calendar-fixture.js';
import {routePath} from '../src/app/routes.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const f=await sharedFixture({port}),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const referenceId='11111111-1111-4111-8111-111111111111';
f.db.prepare('INSERT INTO reference_library VALUES(?,?,?,1)').run(referenceId,'owner',JSON.stringify({name:'Fictional reference board',notes:'Layout QA',images:[],files:[],url:'',tags:'',collection:''}));
f.db.prepare('INSERT INTO school_workspaces VALUES(?,?,1)').run('owner',JSON.stringify({requiredCredits:130,semesters:[{id:'term',name:'Fictional semester'}],courses:[{id:'course',semesterId:'term',name:'Long fictional course name for narrow screen wrapping',credits:3,creditGroup:'',category:'major',grade:'',creditCategory:'major-core',documents:[],tasks:[],events:[]}],graduation:{version:1,areas:[{id:'major',name:'Fictional major requirement with wrapping',group:'major',requiredCredits:60}],mappings:{'major-core':'major'},gpaCourseIds:[]}}));
const project={id:'owner-project',name:'owner project'},projectRoute=view=>routePath({view,username:'owner',project});
const views=[['calendar','/owner/dashboard/schedule','[data-workspace-calendar]'],['school','/owner/school/overview','.school-graduation-table'],['project',projectRoute('home'),'.save-content'],['settings',projectRoute('project-settings'),'[data-form=project]'],['references','/owner/dataspace/references','[data-reference-id]' ],['reference-board','/owner/dataspace/references/'+referenceId,'[data-reference-attachment-add]']];
const baseline=process.env.STUDIO_GUTTER_BASE||'c7f751519aaa0a345c26a4ecc1ef381b62534404';
const oldCss=Object.fromEntries(['styles.css','workspaces.css'].map(file=>[file,execFileSync('git',['show',baseline+':src/'+file],{encoding:'utf8'})]));
const contexts=[];
try{
 const pages=[];const errors=[];
 for(const old of [true,false]){const context=await browser.newContext();contexts.push(context);await context.addCookies([{url:f.origin,name:'studio_session',value:'owner'}]);if(old)for(const [file,body]of Object.entries(oldCss))await context.route('**/src/'+file,route=>route.fulfill({contentType:'text/css',body}));const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error',e.message);});pages.push(page);}
 const metrics=async page=>page.locator('.main>.content').evaluate(node=>{const s=getComputedStyle(node),main=node.parentElement.getBoundingClientRect(),box=node.getBoundingClientRect(),inner=node.querySelector('.save-content').getBoundingClientRect(),bar=getComputedStyle(document.querySelector('.topbar')),sidebar=getComputedStyle(document.querySelector('.project-sidebar'));return {left:parseFloat(s.paddingLeft),right:parseFloat(s.paddingRight),width:box.width,main:main.width,innerInset:inner.x-box.x,header:parseFloat(bar.paddingLeft),sidebar:sidebar.paddingLeft,font:s.fontSize,overflow:document.documentElement.scrollWidth>innerWidth};});
 const results=[];
 for(const width of [320,359,360,390,600,601,768,900,901,1440])for(const [view,path,selector]of views){
  const pair=[];
  for(const page of pages){await page.setViewportSize({width,height:1000});await page.goto(f.origin+path);await page.locator(selector).first().waitFor({state:'visible'});if(view==='calendar')await page.waitForFunction(()=>document.querySelector('[data-workspace-calendar]')?.dataset.calendarLoading==='false');pair.push(await metrics(page));}
  const [before,after]=pair,expected=width<=600?(width<360?28:32):(width<=900?28:24);
  assert.equal(after.left,expected,JSON.stringify({width,view,before,after}));assert.equal(after.right,expected);assert.equal(after.header,expected);assert.ok(Math.abs(after.innerInset-expected)<1,'nested gutter '+JSON.stringify({width,view,after}));assert.equal(after.overflow,false,view+' overflow '+width);assert.equal(after.sidebar,before.sidebar,'sidebar changed');assert.equal(after.font,before.font);assert.equal(after.width,after.main);if(width>600)assert.deepEqual(after,before);
  results.push({width,view,before:before.left,after:after.left});if(view==='reference-board')console.log('PASS width',width);
  if([320,390].includes(width)&&['school','calendar','reference-board'].includes(view))await pages[1].screenshot({path:'/tmp/studio-gutter-'+view+'-'+width+'.png'});
 }
 const page=pages[1];await page.setViewportSize({width:320,height:900});await page.goto(f.origin+projectRoute('project-settings'));const trigger=page.getByRole('button',{name:'아이콘 선택',exact:true});await trigger.focus();await page.keyboard.press('Enter');await page.locator('#project-icon-popover').waitFor({state:'visible'});await page.getByLabel('아이콘 검색',{exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);assert.ok(await trigger.evaluate(n=>n.getBoundingClientRect().height>=44));
 const dialogMetrics=[];
 for(const p of pages){await p.setViewportSize({width:320,height:900});await p.goto(f.origin+'/owner/school/overview');await p.locator('[data-school-workspace],.school-workspace').first().waitFor();const button=p.locator('[data-school-term-add]');if(await button.count()){await button.click();}else{await p.goto(f.origin+'/owner/school/semesters');await p.locator('[data-school-term-add]').click();}await p.locator('dialog.school-dialog').waitFor();dialogMetrics.push(await p.locator('dialog.school-dialog').evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),header=getComputedStyle(n.querySelector('.school-dialog-header'));return {width:r.width,left:r.left,right:r.right,padding:s.padding,header:header.paddingLeft,overflow:document.documentElement.scrollWidth>innerWidth};}));await p.locator('dialog.school-dialog').evaluate(n=>n.close());}
 assert.deepEqual(dialogMetrics[0],dialogMetrics[1]);assert.equal(dialogMetrics[1].overflow,false);
 assert.deepEqual(errors,[]);console.log('PASS current/baseline gutter matrix, single nested inset, header alignment, unchanged sidebar/tablet/desktop/font/dialog, keyboard picker at320, no page overflow',JSON.stringify(results));
}finally{await browser.close();await f.close();}
