// Sequential local child probes against a fictional loopback health endpoint.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {checkHealth} from './healthcheck.js';
if(process.argv[2]){
 const port=Number(process.argv[3]);const ok=process.argv[2]==='fetch'?(await fetch('http://127.0.0.1:'+port+'/health')).ok:await checkHealth({port});console.log(JSON.stringify({mode:process.argv[2],ok,maxRssKiB:process.resourceUsage().maxRSS}));process.exitCode=ok?0:1;
}else{
 const server=createServer((_req,res)=>res.end('{"ok":true}'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const mode of ['fetch','http'])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[new URL(import.meta.url).pathname,mode,String(server.address().port)],{stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',data=>out+=data);child.once('error',reject);child.once('exit',code=>{if(code)reject(Error('Synthetic health probe failed'));else{process.stdout.write(out);resolve();}});});}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
