// Fictional local image fixtures; never calls Google or an external image service.
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createApp} from '../server/index.js';
import {digest} from '../server/auth.js';
const {chromium}=await import(process.env.STUDIO_PLAYWRIGHT_MODULE||'playwright');
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const origin='http://127.0.0.1:'+port,dir=await mkdtemp('/tmp/studio-image-preview-'),app=await createApp({dir,origin,secure:false});
app.db.prepare('INSERT INTO users VALUES(?,?,?)').run('fictional-owner','fictional-owner','unused');app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest('preview-fixture'),'fictional-owner',Date.now()+600000);
await new Promise(r=>app.server.listen(port,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.context().addCookies([{name:'studio_session',value:'preview-fixture',url:origin}]);await page.goto(origin);
 const result=await page.evaluate(async()=>{
  const {prepareImagePreview}=await import('/src/media/image-preview.js'),{upload}=await import('/src/integrations/api.js');
  const canvas=new OffscreenCanvas(2048,1536),context=canvas.getContext('2d'),pixels=context.createImageData(2048,1536);
  let random=1;for(let i=0;i<pixels.data.length;i+=4){random=(random*1664525+1013904223)>>>0;pixels.data[i]=random&255;pixels.data[i+1]=(random>>>8)&255;pixels.data[i+2]=(random>>>16)&255;pixels.data[i+3]=255;}context.putImageData(pixels,0,0);
  const encoded=await canvas.convertToBlob({type:'image/jpeg',quality:.95});
  // Synthetic sRGB fixture: strip the browser's optional ICC APP2 metadata so
  // this measures the supported profile-free JPEG contract, not a skip path.
  const raw=new Uint8Array(await encoded.arrayBuffer()),parts=[raw.subarray(0,2)];let pos=2;while(pos+4<raw.length){if(raw[pos]!==255)break;const marker=raw[pos+1];if(marker===218){parts.push(raw.subarray(pos));pos=raw.length;break;}const size=(raw[pos+2]<<8)|raw[pos+3],end=pos+2+size;if(marker!==226)parts.push(raw.subarray(pos,end));pos=end;}const input=new Blob(parts,{type:'image/jpeg'}),file=new File([input],'fictional-noise.jpg',{type:'image/jpeg'});globalThis.fixturePreviewFile=file;
  const single=async mode=>{const bytes=await file.arrayBuffer(),worker=new Worker('/src/media/image-preview-worker.js',{type:'module'});return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(Error('worker timeout'));},15000);worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('worker error'));};worker.onmessage=async({data})=>{clearTimeout(timer);worker.terminate();if(data.skipped)return reject(Error('fixture skipped: '+data.reason));const bitmap=await createImageBitmap(new Blob([data.bytes],{type:data.type}));const output={mode,referenceBytes:data.reference?.byteLength||0,milliseconds:data.milliseconds,bytes:data.bytes.byteLength,width:bitmap.width,height:bitmap.height,wasmMemoryBytes:data.wasmMemoryBytes||null};bitmap.close();resolve(output);};worker.postMessage({bytes,type:file.type,mode},[bytes]);});};
  const measurements=[];for(const mode of ['rust','native','rust','native'])measurements.push(await single(mode));
  const saved=await upload(file),preview=await fetch(saved.url+'?preview=1'),original=await fetch(saved.url);
  const originalBytes=await original.arrayBuffer(),hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',');
  if(await hash(originalBytes)!==await hash(await file.arrayBuffer()))throw Error('Original bytes changed');
  const reference=await(await fetch(saved.url+'?preview=reference')).blob(),referenceBitmap=await createImageBitmap(reference);if(referenceBitmap.width!==600||referenceBitmap.height!==450||reference.size>1000000)throw Error('Wrong reference dimensions');referenceBitmap.close();
  const pre=await preview.blob(),bitmap=await createImageBitmap(pre);if(bitmap.width!==256||bitmap.height!==192)throw Error('Wrong aspect');bitmap.close();
  const list=await(await fetch('/api/materials')).json();if(!list.items.find(item=>item.fileId===saved.id)?.thumbnailAvailable)throw Error('Missing derivative metadata');
  const abort=new AbortController();abort.abort();if(await prepareImagePreview(file,{signal:abort.signal})!==null)throw Error('Abort ignored');
  const alphaCanvas=new OffscreenCanvas(100,100);alphaCanvas.getContext('2d').fillStyle='rgba(30,60,90,.5)';alphaCanvas.getContext('2d').fillRect(0,0,100,100);const alphaFile=new File([await alphaCanvas.convertToBlob({type:'image/png'})],'fictional-alpha.png',{type:'image/png'}),alpha=await prepareImagePreview(alphaFile);if(!alpha)throw Error('Alpha skipped');const alphaBitmap=await createImageBitmap(alpha.blob),check=new OffscreenCanvas(100,100);check.getContext('2d').drawImage(alphaBitmap,0,0);const actualAlpha=check.getContext('2d').getImageData(0,0,1,1).data[3];alphaBitmap.close();if(Math.abs(actualAlpha-128)>1)throw Error('Alpha lost');
  return {originalUrl:saved.url,originalBytes:input.size,previewBytes:pre.size,measurements,originalUnchanged:true,referenceBytes:reference.size,previewStored:saved.previewStored,alphaPreserved:true,abortPreservedOriginalPath:true};
 });
 const originalReads=[];page.on('request',request=>{const url=new URL(request.url());if(request.method()==='GET'&&/^\/api\/files\/[a-f0-9-]{36}$/.test(url.pathname)&&!url.searchParams.has('preview'))originalReads.push(url.pathname);});
 await page.goto(origin+'/fictional-owner/dataspace/materials');await page.locator('[data-material-card]').waitFor();await page.locator('[data-material-card] img').first().evaluate(image=>image.decode());assert.equal(originalReads.length,0);
 let rejectPair=true;await page.route('**/api/files/*/preview',route=>{if(rejectPair&&route.request().method()==='PUT'){rejectPair=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fictional preview failure'})});}return route.continue();});
 // Retain the synthetic fixture across this navigation without using real files.
 await page.evaluate(async()=>{const canvas=new OffscreenCanvas(800,600);canvas.getContext('2d').fillRect(0,0,800,600);const file=new File([await canvas.convertToBlob({type:'image/png'})],'fictional-retry.png',{type:'image/png'}),transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('[data-material-upload]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('[data-material-preview-retry]:visible').waitFor();const originalsBeforeRetry=app.db.prepare('SELECT count(*) n FROM files').get().n;await page.locator('[data-material-preview-retry]').click();await page.locator('[data-material-preview-retry]').waitFor({state:'hidden'});assert.equal(app.db.prepare('SELECT count(*) n FROM files').get().n,originalsBeforeRetry);assert.equal(app.db.prepare('SELECT count(*) n FROM file_previews').get().n,4);assert.equal(originalReads.length,0);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 const refResponse=await page.request.post(origin+'/api/reference-library',{headers:{Origin:origin},data:{name:'Fictional preview reference',images:[result.originalUrl]}});assert.equal(refResponse.status(),201);const referenceResult=await refResponse.json();const refId=referenceResult.reference?.id||referenceResult.id;
 await page.goto(origin+'/fictional-owner/dataspace/references/'+refId);await page.locator('img.reference-board-image').waitFor();assert.ok((await page.locator('img.reference-board-image').first().getAttribute('src')).endsWith('?preview=reference'));await page.locator('img.reference-board-image').first().evaluate(image=>image.decode());assert.equal(originalReads.length,0);await page.screenshot({path:'/tmp/studio-reference-derivative.png'});
 result.galleryNoOriginalReads=true;result.previewRetryNoDuplicateOriginal=true;result.referenceUsesMedium=true;
 assert.deepEqual(errors,[]);await writeFile('/tmp/studio-image-preview-measurements.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
