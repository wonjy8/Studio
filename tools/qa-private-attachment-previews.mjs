// Only synthetic images and fictional local sessions. No external provider calls.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const origin='http://127.0.0.1:'+port,dir=await mkdtemp('/tmp/studio-private-attachment-browser-'),app=await createApp({dir,origin,secure:false});
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('fixture-owner','fixture-owner','unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest('fixture-token'),'fixture-owner',Date.now()+600000);
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.context().addCookies([{name:'studio_session',value:'fixture-token',url:origin}]);
 await page.goto(origin+'/src/media/preview-licenses.txt');
 for(const path of ['styles.css','workspaces.css','theme.css','controls.css','document-display.css'])await page.addStyleTag({url:origin+'/src/'+path});
 const school=await page.evaluate(async()=>{
  const canvas=new OffscreenCanvas(800,600);canvas.getContext('2d').fillRect(0,0,800,600);const file=new File([await canvas.convertToBlob({type:'image/png'})],'fixture.png',{type:'image/png'});globalThis.fixtureImage=file;
  const {upload}=await import('/src/integrations/api.js');const saved=await upload(file,{resource:'school/files'});
  const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).join(',');if(await hash(await file.arrayBuffer())!==await hash(await(await fetch(saved.url)).arrayBuffer()))throw Error('School original altered');
  const bitmap=await createImageBitmap(await(await fetch(saved.url+'?preview=reference')).blob());if(bitmap.width!==600||bitmap.height!==450)throw Error('School preview dimensions');bitmap.close();return saved;
 });assert.equal(school.previewStored,true);
 let failPair=true;await page.route('**/api/document-files/*/preview',route=>{if(failPair){failPair=false;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic preview outage"}'});}return route.continue();});
 await page.evaluate(async()=>{const {pickDocumentImage}=await import('/src/features/document-image-picker.js');globalThis.pickResult=pickDocumentImage({accountId:'fixture-owner'});const transfer=new DataTransfer();transfer.items.add(globalThis.fixtureImage);const input=document.querySelector('.document-image-picker input');input.files=transfer.files;input.dispatchEvent(new Event('change'));});
 await page.locator('[data-image-upload]').click();await page.getByText('Synthetic preview outage',{exact:true}).waitFor();assert.equal(app.db.prepare('SELECT count(*) n FROM document_files').get().n,1);
 await page.locator('[data-image-upload]').click();await page.locator('.document-image-picker').waitFor({state:'detached'});assert.equal(app.db.prepare('SELECT count(*) n FROM document_files').get().n,1);assert.equal(app.db.prepare('SELECT count(*) n FROM document_file_previews').get().n,2);
 const originalReads=[];page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&/^\/api\/(document-files|school\/files)\/[a-f0-9-]{36}$/.test(u.pathname)&&!u.searchParams.has('preview'))originalReads.push(u.pathname);});
 await page.evaluate(async()=>{const url=await globalThis.pickResult,{newDocument,newBlock}=await import('/src/domain/documents.js'),{documentsPage,bindDocuments}=await import('/src/features/documents.js');const doc=newDocument('Fixture image');doc.blocks=[{...newBlock('image'),url}];document.body.innerHTML=documentsPage();bindDocuments({project:{id:'fixture-project',name:'Fixture'},documents:[doc]},{namespace:'fixture-owner',onPersist:async()=>{}});});
 await page.locator('.document-image').evaluate(img=>img.decode());assert.equal(originalReads.length,0);assert.match(await page.locator('.document-image').getAttribute('src'),/preview=reference$/);assert.ok(await page.locator('.document-image-original').getAttribute('href'));
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);console.log('PASS: private School and document upload originals preserved; paired retry without duplicate; document display uses medium only; mobile fit');
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
