import {get} from 'node:http';
import {fileURLToPath} from 'node:url';
// Fixed loopback only. No DNS, proxy, credentials or external connectivity needed.
export function checkHealth({port=8080,timeoutMs=2000}={}) {
  return new Promise(resolve=>{
    let finished=false;
    const finish=value=>{if(finished)return;finished=true;resolve(value);};
    const req=get({host:'127.0.0.1',port,path:'/health',agent:false,maxHeaderSize:8192},res=>{
      if(res.statusCode!==200){res.resume();finish(false);return;}
      let body='',size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>1024){finish(false);res.destroy();req.destroy();}else body+=chunk.toString('utf8');});
      res.on('end',()=>{try{finish(JSON.parse(body).ok===true);}catch{finish(false);}});
      res.on('error',()=>finish(false));
    });
    req.setTimeout(timeoutMs,()=>{finish(false);req.destroy();});
    req.on('error',()=>finish(false));
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))process.exitCode=await checkHealth()?0:1;
