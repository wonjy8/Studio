// Local synthetic stream only. No server, credentials, files or external network.
import {spawnSync} from 'node:child_process';
import {limitedResponseText} from '../server/limited-response.js';
if(!['old','bounded'].includes(process.argv[2])){
 for(const mode of ['old','bounded']){const child=spawnSync(process.execPath,['--expose-gc',new URL(import.meta.url).pathname,mode],{encoding:'utf8'});if(child.status!==0)throw Error(child.stderr||'Measurement failed');process.stdout.write(child.stdout);}process.exit(0);
}
const mode=process.argv[2],total=64*1024*1024,limit=2*1024*1024,chunk=65536;let bytesRead=0,cancelled=false;
global.gc();const before=process.memoryUsage();
const response=new Response(new ReadableStream({pull(controller){if(bytesRead===total){controller.close();return;}const value=new Uint8Array(Math.min(chunk,total-bytesRead)).fill(97);bytesRead+=value.length;controller.enqueue(value);},cancel(){cancelled=true;}},{highWaterMark:0}));
try{if(mode==='old'){const text=await response.text();if(text.length>limit)throw Error('limit');}else await limitedResponseText(response,limit,()=>Error('limit'));}catch(error){if(error.message!=='limit')throw error;}
const after=process.memoryUsage(),maxRssKiB=process.resourceUsage().maxRSS;global.gc();const afterGc=process.memoryUsage();console.log(JSON.stringify({mode,syntheticBodyMiB:total/1048576,bytesReadMiB:bytesRead/1048576,cancelled,maxRssKiB,rssDeltaMiB:(after.rss-before.rss)/1048576,arrayBuffersDeltaMiB:(after.arrayBuffers-before.arrayBuffers)/1048576,rssAfterGcMiB:afterGc.rss/1048576}));
