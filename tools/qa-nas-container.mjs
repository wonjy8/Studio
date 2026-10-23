// Isolated local Docker only. No NAS, tunnel credentials or external API calls.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {request} from 'node:http';
const exec=promisify(execFile),docker=async(...args)=>(await exec('docker',args,{maxBuffer:1024*1024})).stdout.trim();
const endpoint=JSON.parse(await docker('context','inspect','--format','{{json .Endpoints.docker.Host}}'));assert.ok(endpoint.startsWith('unix://'),'Refuse nonlocal Docker');if(process.env.DOCKER_HOST)assert.ok(process.env.DOCKER_HOST.startsWith('unix://'),'Refuse nonlocal Docker override');
const suffix=randomUUID().slice(0,8),name='studio-qa-'+suffix,volume=name+'-data',network=name+'-net',image=process.env.STUDIO_LOCAL_TEST_IMAGE||'studio-nas-candidate:c1e4d66';assert.ok(image.startsWith('studio-nas-candidate:'),'Local candidate image only');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let networkMade=false,volumeMade=false,containerMade=false;
try{
 await docker('network','create',network);networkMade=true;await docker('volume','create',volume);volumeMade=true;
 await docker('run','-d','--name',name,'--network',network,'--network-alias','studio','-p','127.0.0.1::8080','--read-only','--tmpfs','/tmp:size=16m,noexec,nosuid','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','512m','-e','APP_ORIGIN=http://localhost','-e','COOKIE_SECURE=false','--mount','type=volume,src='+volume+',dst=/data',image);containerMade=true;
 const health=async()=>{for(let i=0;i<45;i++){const state=JSON.parse(await docker('inspect','--format','{{json .State}}',name));assert.equal(state.Running,true,'Fixture process stopped');if(state.Health?.Status==='healthy')return;await sleep(1000);}throw Error('Actual Docker healthcheck did not become healthy');};await health();
 assert.equal(await docker('exec',name,'node','tools/healthcheck.js'),'');
 await docker('run','--rm','--network',network,'--entrypoint','node',image,'-e',"fetch('http://studio:8080/health').then(async r=>{if(!r.ok||!(await r.json()).ok)process.exitCode=1}).catch(()=>process.exitCode=1)");
 const seed="import {DatabaseSync} from 'node:sqlite';import {digest} from './server/auth.js';const db=new DatabaseSync('/data/studio.sqlite');db.prepare('INSERT INTO users VALUES(?,?,?)').run('qa-owner','qa-owner','unused-fixture');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest('qa-only-session'),'qa-owner',Date.now()+600000);db.close();";
 await docker('exec',name,'node','--input-type=module','-e',seed);
 const mapping=await docker('port',name,'8080/tcp');assert.match(mapping,/^127\.0\.0\.1:\d+$/);const port=Number(mapping.split(':').at(-1)),bytes=Buffer.alloc(2*1024*1024,113);Buffer.from('%PDF-1.7\nSynthetic').copy(bytes);let started;
 const ready=new Promise(r=>started=r);const upload=new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port,path:'/api/files',method:'POST',headers:{Origin:'http://localhost',Cookie:'studio_session=qa-only-session','Content-Type':'application/pdf','Content-Length':bytes.length,Expect:'100-continue'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});req.on('error',reject);req.on('continue',()=>{req.write(bytes.subarray(0,65536));started();setTimeout(()=>req.end(bytes.subarray(65536)),500);});req.flushHeaders();});await ready;
 const waiting=docker('wait',name);await docker('kill','--signal','SIGTERM',name);const uploaded=await upload;assert.equal(uploaded.status,201);assert.equal(await waiting,'0');const stopped=JSON.parse(await docker('inspect','--format','{{json .State}}',name));assert.equal(stopped.OOMKilled,false);
 await docker('start',name);await health();const verify="import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';const db=new DatabaseSync('/data/studio.sqlite');const row=db.prepare('SELECT bytes FROM files WHERE id=? AND user_id=?').get(process.argv[1],'qa-owner');if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||!row||createHash('sha256').update(row.bytes).digest('hex')!==process.argv[2])process.exitCode=1;db.close();";await docker('exec',name,'node','--input-type=module','-e',verify,uploaded.body.id,createHash('sha256').update(bytes).digest('hex'));
 console.log(JSON.stringify({image,actualDockerHealth:true,isolatedBridgeOrigin:true,activeUploadDrained:true,exitCode:0,oomKilled:false,sqliteAfterRestart:'ok',fixtureOnly:true}));
}finally{if(containerMade)await docker('rm','-f',name).catch(()=>{});if(volumeMade)await docker('volume','rm',volume).catch(()=>{});if(networkMade)await docker('network','rm',network).catch(()=>{});}
