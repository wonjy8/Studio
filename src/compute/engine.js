import {computeBinary} from '../media/compute-binary.js';
const encoder=new TextEncoder(),decoder=new TextDecoder();
export async function createComputeEngine(){
 const url=new URL(computeBinary,new URL('../media/',import.meta.url));
 const bytes=typeof process!=='undefined'&&process.versions?.node?await(await import('node:fs/promises')).readFile(url):await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout(10000)}).then(response=>{if(!response.ok)throw Error('Rust 처리 모듈을 불러오지 못했습니다.');return response.arrayBuffer();});
 const {instance}=await WebAssembly.instantiate(bytes),wasm=instance.exports;
 const copy=bytes=>{const ptr=wasm.alloc(bytes.byteLength);new Uint8Array(wasm.memory.buffer,ptr,bytes.byteLength).set(bytes);return ptr;};
 const free=(ptr,size)=>{new Uint8Array(wasm.memory.buffer,ptr,size).fill(0);wasm.release(ptr,size);};
 const decode=(ptr,size)=>decoder.decode(new Uint8Array(wasm.memory.buffer,ptr,size));
 function run(op,bytes){const ptr=copy(bytes);try{const status=wasm.run(op,ptr,bytes.byteLength),result=JSON.parse(decode(wasm.output_ptr(),wasm.output_len()));if(status)throw Object.assign(Error(result),{status:400});return result;}finally{free(ptr,bytes.byteLength);}}
 function packet(texts){let size=0;for(const text of texts)size+=4+text.length*2;const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);let pos=0;for(const text of texts){view.setUint32(pos,text.length*2,true);pos+=4;for(let i=0;i<text.length;i++){view.setUint16(pos,text.charCodeAt(i),true);pos+=2;}}return bytes;}
 return {
  get memoryBytes(){return wasm.memory.buffer.byteLength;},
  unzip(bytes){try{run(1,bytes);const files=new Map();for(let i=0;i<wasm.file_count();i++)files.set(decode(wasm.file_name_ptr(i),wasm.file_name_len(i)),decode(wasm.file_text_ptr(i),wasm.file_text_len(i)));return files;}finally{wasm.reset_files();}},
  csv(text){return run(2,encoder.encode(text));},
  index(texts){const count=texts.length,bytes=packet(texts),bytesLength=bytes.byteLength,ptr=copy(bytes);bytes.fill(0);const out=wasm.alloc(count*4);let disposed=false;return {
   search(terms){if(disposed)throw Error('검색 화면이 만료되었습니다.');const bytes=packet(terms),query=copy(bytes);try{const count=wasm.search(ptr,bytesLength,query,bytes.byteLength,out);return Array.from(new Uint32Array(wasm.memory.buffer,out,count));}finally{free(query,bytes.byteLength);}},
   dispose(){if(disposed)return;disposed=true;free(ptr,bytesLength);free(out,count*4);}
  };},
  lanes(events){const input=new Float64Array(events.length*2);events.forEach((event,i)=>{input[i*2]=event.start;input[i*2+1]=event.end;});const ptr=copy(new Uint8Array(input.buffer)),out=wasm.alloc(events.length*12);try{wasm.lanes(ptr,events.length,out);const result=new Uint32Array(wasm.memory.buffer,out,events.length*3);return Array.from({length:events.length},(_,i)=>({index:result[i*3],lane:result[i*3+1],columns:result[i*3+2]}));}finally{free(ptr,input.byteLength);free(out,events.length*12);}}
 };
}
