// One disposable worker at a time: no full-size decode on the UI thread and no
// retained WASM heap. Original files remain untouched on every failure path.
const waiting=[];let active=false;
function next(){
 if(active||!waiting.length)return;
 active=true;const job=waiting.shift();job.signal?.removeEventListener('abort',job.cancel);
 run(job.file,job.signal).then(job.resolve,()=>job.resolve(null)).finally(()=>{active=false;next();});
}
export function prepareImagePreview(file,{signal}={}){
 if(!['image/jpeg','image/png'].includes(file.type)||file.size>8*1024*1024||typeof Worker==='undefined'||signal?.aborted||waiting.length>=4)return Promise.resolve(null);
 return new Promise(resolve=>{const job={file,signal,resolve};job.cancel=()=>{const index=waiting.indexOf(job);if(index>=0){waiting.splice(index,1);signal?.removeEventListener('abort',job.cancel);resolve(null);}};signal?.addEventListener('abort',job.cancel,{once:true});waiting.push(job);next();});
}
async function run(file,signal){
 if(signal?.aborted)return null;
 const bytes=await file.arrayBuffer();if(signal?.aborted)return null;
 return new Promise(resolve=>{
  const worker=new Worker(new URL('./image-preview-worker.js',import.meta.url),{type:'module'});
  let complete=false;
  const done=value=>{if(complete)return;complete=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();resolve(value);};
  const abort=()=>done(null),timer=setTimeout(abort,30000);
  signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=abort;
  worker.onmessage=({data})=>done(data?.bytes instanceof ArrayBuffer&&data.bytes.byteLength<=512*1024?{blob:new Blob([data.bytes],{type:data.type}),milliseconds:data.milliseconds,wasmMemoryBytes:data.wasmMemoryBytes,reference:data.reference instanceof ArrayBuffer&&data.reference.byteLength<=1000000?new Blob([data.reference],{type:data.type}):null}:null);
  worker.postMessage({bytes,type:file.type},[bytes]);
 });
}

// Compatibility hook for document/School uploads: original bytes are untouched.
export async function prepareImageUpload(file,{signal}={}){
 const result=file.type.startsWith('image/')?await prepareImagePreview(file,{signal}):null;
 if(signal?.aborted)throw new DOMException('이미지 처리를 취소했습니다.','AbortError');
 return {file,preview:result?.blob||null,reference:result?.reference||null};
}
