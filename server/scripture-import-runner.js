import {Worker} from 'node:worker_threads';
const failure=(message,status)=>Object.assign(Error(message),{status});
// Reserve before reading a request body. No waiting ZIP buffers, persistent
// decoded snapshots or unbounded worker queue in this memory-constrained app.
export function scriptureImportRunner(){
 let active=null,closed=false;
 const run=async(readBytes,{preview=false,signal}={})=>{
  if(closed)throw failure('서버를 종료하고 있습니다.',503);
  if(active)throw failure('다른 ZIP 파일을 처리하고 있습니다. 완료 후 다시 시도하세요.',429);
  const job={cancel:null};active=job;
  let worker,timer;
  const aborted=()=>{job.cancel?.(failure('ZIP 처리를 취소했습니다.',499));};
  try{
   if(signal?.aborted)throw failure('ZIP 처리를 취소했습니다.',499);
   const bytes=await readBytes();
   if(signal?.aborted||closed)throw failure('ZIP 처리를 취소했습니다.',499);
   // Only transfer a wholly owned buffer; do not detach a Node pooled slab.
   const transferable=bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes.buffer:Uint8Array.from(bytes).buffer;
   worker=new Worker(new URL('./scripture-import-worker.js',import.meta.url));
   return await new Promise((resolve,reject)=>{
    job.cancel=reject;signal?.addEventListener('abort',aborted,{once:true});
    worker.once('error',()=>reject(failure('ZIP 처리 작업을 완료하지 못했습니다.',503)));
    worker.once('exit',code=>reject(failure('ZIP 처리 작업이 종료되었습니다.',503)));
    worker.once('message',message=>message.error?reject(failure(message.error.message,message.error.status)):resolve(message.value));
    timer=setTimeout(()=>reject(failure('ZIP 처리 시간이 초과되었습니다. 파일을 나누어 주세요.',408)),30000);
    worker.postMessage({bytes:transferable,preview},[transferable]);
    if(signal?.aborted||closed)aborted();
   });
  }finally{
   clearTimeout(timer);signal?.removeEventListener('abort',aborted);
   // Keep the slot until termination has released the previous isolate.
   if(worker)await worker.terminate();
   if(active===job)active=null;
  }
 };
 run.close=()=>{closed=true;active?.cancel?.(failure('서버를 종료하고 있습니다.',503));};
 return run;
}
