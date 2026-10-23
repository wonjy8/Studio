// Share only an actively running read, never a completed value or an error.
// Authorization/identity checks remain the caller's responsibility before/after.
export function createReadCoalescer({limit=64}={}){
 const pending=new Map();
 async function run(key,loader){
  let work=pending.get(key);
  if(!work){work=Promise.resolve().then(loader);if(pending.size<limit)pending.set(key,work);}
  try{return await work;}finally{if(pending.get(key)===work)pending.delete(key);}
 }
 return {run,clear:()=>pending.clear()};
}
