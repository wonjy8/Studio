// Local synthetic GET fixtures only. No account, NAS or provider access.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const links=[...(await readFile(resolve(root,'index.html'),'utf8')).matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)].map(match=>match[1]);
let mode='normal',writes=0,reads=0;
const server=http.createServer(async(req,res)=>{
 if(req.method!=='GET'){writes++;res.writeHead(405).end();return;}
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname.startsWith('/api/')){
  reads++;res.setHeader('Content-Type','application/json');
  if(mode==='403'||mode==='503'){res.writeHead(Number(mode)).end(JSON.stringify({error:'Synthetic lookup failure'}));return;}
  const data=pathname==='/api/admin/users'?{users:mode==='empty'?[]:[{id:'fictional-user',username:'fictional-user',name:'가상 사용자',siteRole:'user'}]}:pathname==='/api/admin/organizations'?{organizations:[]}:{contacts:[]};
  res.end(JSON.stringify(data));return;
 }
 try{
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<html><head>'+links.map(href=>`<link rel="stylesheet" href="${href}">`).join('')+'</head><body><div id="app"></div></body></html>');return;}
  const file=resolve(root,'.'+pathname);if(!file.startsWith(root)||!pathname.startsWith('/src/')){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',extname(file)==='.css'?'text/css':extname(file)==='.wasm'?'application/wasm':'text/javascript');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.STUDIO_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[];let cases=0;
try{
 for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  const mount=async kind=>page.evaluate(async({kind,theme})=>{
   document.documentElement.dataset.theme=theme;
   const {emptyWorkspace}=await import('/src/domain/workspace.js'),{appShell}=await import('/src/app/shell.js');
   const state=emptyWorkspace();state.project.id='fixture';
   const session={isAdmin:true,canManageSiteRoles:false,account:{id:'fictional-owner',username:'fictional-owner'}};
   Object.assign((await import('/src/app/session.js')).sessionInfo,session);
   if(kind==='admin'){
    const m=await import('/src/features/admin-directory.js');document.querySelector('#app').innerHTML=appShell({state,view:'admin',session,body:m.adminDirectoryPage(),modal:''});await m.bindAdminDirectory();
   }else if(kind==='documents'){
    const m=await import('/src/features/documents.js'),{newDocument}=await import('/src/domain/documents.js');const doc=newDocument('가상 문서');state.documents=[doc];
    document.querySelector('#app').innerHTML=appShell({state,view:'document-workspace',session,body:m.documentsPage(),modal:''});m.bindDocuments(state,{namespace:crypto.randomUUID(),initialDocumentId:doc.id});
   }else{
    document.querySelector('#app').innerHTML=appShell({state,view:'library',session,body:'<div class="reference-module-inline"><button type="button">+ 자료</button><button type="button">+ 텍스트</button></div>',modal:''});
   }
  },{kind,theme});
  for(mode of ['normal','empty','403','503']){
   await mount('admin');
   const message=page.locator('[data-directory-message]'),list=page.locator('[data-directory-groups]');
   if(mode==='normal')assert.match(await list.innerText(),/가상 사용자/);
   else if(mode==='empty'){assert.match(await list.innerText(),/등록된 항목이 없습니다/);assert.equal(await page.locator('[data-directory-retry]').count(),0);}
   else{
    assert.equal(await message.getAttribute('role'),'alert');assert.match(await message.innerText(),mode==='403'?/권한/:/불러오지 못했습니다/);assert.doesNotMatch(await list.innerText(),/등록된 항목|가상 사용자/);
    mode='normal';const before=reads;await page.locator('[data-directory-retry]').click();await page.getByText('가상 사용자',{exact:true}).first().waitFor();assert.equal(reads-before,3);assert.equal(await page.locator('[data-directory-retry]').count(),0);assert.equal(await message.innerText(),'');
   }
   cases++;
  }
  await mount('reference');for(const button of await page.locator('.reference-module-inline button').all())assert.ok((await button.boundingBox()).height>=(width>900?36:44));cases++;
  await mount('documents');
  for(const attr of ['menu','undo','redo']){
   const button=page.locator('[data-document-'+attr+']');await button.focus();const tip=page.locator('[role=tooltip]');await tip.waitFor();assert.equal(await tip.innerText(),await button.getAttribute('aria-label'));assert.equal(await button.getAttribute('aria-describedby'),await tip.getAttribute('id'));await page.keyboard.press('Escape');assert.equal(await tip.count(),0);assert.equal(await button.evaluate(node=>node===document.activeElement),true);
  }
  await page.locator('[data-document-menu]').hover();await page.locator('[role=tooltip]').waitFor();await mount('reference');await page.waitForTimeout(0);assert.equal(await page.locator('[role=tooltip]').count(),0);cases++;
  await page.evaluate(async()=>{const m=await import('/src/features/calendar-event-editor.js');await m.openCalendarEventEditor({load:async()=>({editorTitle:'일정 추가',title:'가상 일정',canEdit:true,start:'2026-10-23T09:00',end:'2026-10-23T10:00'}),save:async()=>{throw Error('No writes');}});});
  assert.equal(await page.locator('dialog').getAttribute('aria-label'),'일정 추가');await page.keyboard.press('Escape');cases++;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.close();
 }
 assert.equal(writes,0);assert.deepEqual(errors,[]);console.log(`PASS: ${cases} viewport/theme/state cases; zero mutations and browser errors.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
