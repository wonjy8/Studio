import {boundedRaster} from '../domain/material-colors.js';
import {previewBinary} from './preview-binary.js';

self.onmessage=async({data})=>{
 let bitmap;
 try{
  const input=new Uint8Array(data.bytes);
  if(!input.length||input.length>8*1024*1024)throw Error('input-limit');
  const started=performance.now();
  if(data.mode==='native'){
   if(!boundedRaster(input,data.type))throw Error('pixel-limit');
   // Measurement baseline only; production always requests the Rust path.
   bitmap=await createImageBitmap(new Blob([input],{type:data.type}));
   if(bitmap.width*bitmap.height>8000000)throw Error('pixel-limit');
   const scale=Math.min(1,256/bitmap.width,256/bitmap.height),canvas=new OffscreenCanvas(Math.max(1,Math.round(bitmap.width*scale)),Math.max(1,Math.round(bitmap.height*scale)));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await canvas.convertToBlob({type:data.type,quality:.78}),bytes=await blob.arrayBuffer();
   const referenceScale=Math.min(1,600/bitmap.width,600/bitmap.height),referenceCanvas=new OffscreenCanvas(Math.max(1,Math.round(bitmap.width*referenceScale)),Math.max(1,Math.round(bitmap.height*referenceScale)));referenceCanvas.getContext('2d').drawImage(bitmap,0,0,referenceCanvas.width,referenceCanvas.height);const reference=await(await referenceCanvas.convertToBlob({type:data.type,quality:.82})).arrayBuffer();
   self.postMessage({bytes,reference,type:blob.type,milliseconds:performance.now()-started,mode:'native'},[bytes,reference]);return;
  }
  const response=await fetch(new URL(previewBinary,import.meta.url));
  if(!response.ok)throw Error('module-unavailable');
  const {instance}=await WebAssembly.instantiateStreaming(response,{}),wasm=instance.exports;
  const pointer=wasm.allocate(input.byteLength);if(!pointer)throw Error('allocation-limit');
  try{
   new Uint8Array(wasm.memory.buffer,pointer,input.length).set(input);
   if(wasm.generate(pointer,input.length)!==1)throw Error('unsupported-or-bounded-input');
   const length=wasm.output_length();if(!length||length>512*1024)throw Error('output-limit');
   const referenceLength=wasm.reference_length();if(!referenceLength||referenceLength>1000000)throw Error('reference-limit');
   const reference=wasm.memory.buffer.slice(wasm.reference_pointer(),wasm.reference_pointer()+referenceLength);
   const bytes=wasm.memory.buffer.slice(wasm.output_pointer(),wasm.output_pointer()+length),header=new Uint8Array(bytes);
   self.postMessage({bytes,reference,type:header[0]===255?'image/jpeg':'image/png',milliseconds:performance.now()-started,wasmMemoryBytes:wasm.memory.buffer.byteLength,mode:'rust'},[bytes,reference]);
  }finally{wasm.release(pointer,input.length);}
 }catch(error){self.postMessage({skipped:true,reason:['input-limit','pixel-limit','module-unavailable','allocation-limit','unsupported-or-bounded-input','output-limit','reference-limit'].includes(error.message)?error.message:error.name});}finally{bitmap?.close();}
};
