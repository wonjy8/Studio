import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {previewBinary,previewSourceHash} from '../src/media/preview-binary.js';
import {imageVariantUrl} from '../src/media/image-variants.js';

test('versioned WASM has no imports, validates ABI and refuses unbounded allocation',async()=>{
 const bytes=await readFile(new URL('../src/media/'+previewBinary.slice(2),import.meta.url));
 assert.equal(previewBinary,'./preview-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.wasm');
 const sourceHash=createHash('sha256');for(const file of ['image-preview/Cargo.toml','image-preview/Cargo.lock','image-preview/src/lib.rs','tools/build-image-preview.mjs'])sourceHash.update(file+'\0').update(await readFile(new URL('../'+file,import.meta.url)));assert.equal(sourceHash.digest('hex'),previewSourceHash);
 assert.ok(bytes.length<600000);const module=await WebAssembly.compile(bytes);assert.deepEqual(WebAssembly.Module.imports(module),[]);
 const instance=await WebAssembly.instantiate(module,{}),e=instance.exports;assert.equal(e.allocate(8*1024*1024+1),0);assert.equal(e.generate(0,1),0);assert.equal(e.output_length(),0);assert.equal(e.reference_length(),0);
 assert.throws(()=>e.memory.grow(2048),RangeError);
 const ptr=e.allocate(100);assert.ok(ptr);e.release(ptr,100);
 assert.equal(imageVariantUrl('/api/files/00000000-0000-0000-0000-000000000000'),'/api/files/00000000-0000-0000-0000-000000000000?preview=reference');
 assert.equal(imageVariantUrl('/api/files/00000000-0000-0000-0000-000000000000','thumbnail'),'/api/files/00000000-0000-0000-0000-000000000000?preview=1');
});

test('worker queue bounds concurrency, cancels waiting jobs and preserves unsupported originals',async()=>{
 const previous=globalThis.Worker;let active=0,peak=0;
 class FictionalWorker{
  constructor(){this.stopped=false;active++;peak=Math.max(peak,active);}
  postMessage(){this.timer=setTimeout(()=>this.onmessage({data:{bytes:new ArrayBuffer(16),reference:new ArrayBuffer(32),type:'image/png'}}),20);}
  terminate(){if(this.stopped)return;this.stopped=true;active--;clearTimeout(this.timer);}
 }
 globalThis.Worker=FictionalWorker;
 try{
  const {prepareImagePreview,prepareImageUpload}=await import('../src/media/image-preview.js');
  const file=new File(['fictional bytes'],'fixture.png',{type:'image/png'}),first=prepareImagePreview(file),cancel=new AbortController(),pending=prepareImagePreview(file,{signal:cancel.signal});cancel.abort();
  assert.equal(await pending,null);assert.ok(await first);
  const jobs=Array.from({length:6},()=>prepareImagePreview(file));const results=await Promise.all(jobs);assert.equal(peak,1);assert.ok(results.some(value=>value===null));
  const other=new File(['fictional HEIC bytes'],'fixture.heic',{type:'image/heic'});assert.equal((await prepareImageUpload(other)).file,other);assert.equal((await prepareImageUpload(other)).preview,null);
 }finally{globalThis.Worker=previous;}
});
