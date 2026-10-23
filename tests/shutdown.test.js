import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createServer,request} from 'node:http';
import {installGracefulShutdown} from '../server/shutdown.js';
test('SIGTERM drains active HTTP request before cleanup and ignores duplicate signals',async t=>{
 const signals=new EventEmitter();let finish,entered,closed=false,failures=0;
 const started=new Promise(r=>entered=r),server=createServer((req,res)=>{entered();finish=()=>res.end('saved');});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.closeAllConnections());const dispose=installGracefulShutdown(server,{signals,timeoutMs:1000,onFailure:()=>failures++});t.after(dispose);server.on('close',()=>closed=true);
 const response=new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.address().port},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve(text));});req.on('error',reject);req.end();});await started;const completed=new Promise(r=>server.once('close',r));signals.emit('SIGTERM');signals.emit('SIGINT');assert.equal(closed,false);finish();assert.equal(await response,'saved');await completed;assert.equal(closed,true);assert.equal(failures,0);assert.equal(signals.listenerCount('SIGTERM'),0);
});
test('deadline closes stalled HTTP connections, reports forced shutdown and removes handlers',async t=>{
 const signals=new EventEmitter();let entered;const started=new Promise(r=>entered=r),server=createServer(()=>entered());await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.closeAllConnections());let failed=0;const dispose=installGracefulShutdown(server,{signals,timeoutMs:20,onFailure:()=>failed++});t.after(dispose);
 const connection=new Promise(resolve=>{const req=request({host:'127.0.0.1',port:server.address().port});req.on('error',e=>resolve(e.code));req.end();});await started;const closed=new Promise(r=>server.once('close',r));signals.emit('SIGTERM');assert.equal(await connection,'ECONNRESET');await closed;assert.equal(failed,1);assert.equal(signals.listenerCount('SIGINT'),0);
});

test('standalone NAS entry exits normally on SIGTERM and leaves SQLite readable',async t=>{
 const {spawn}=await import('node:child_process'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{DatabaseSync}=await import('node:sqlite');const dir=await mkdtemp(join(tmpdir(),'studio-stop-fixture-'));t.after(()=>rm(dir,{recursive:true,force:true}));const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,DATA_DIR:dir,PORT:'0',APP_ORIGIN:'http://localhost',COOKIE_SECURE:'false',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',BIBLE_GITHUB_TOKEN:''},stdio:['ignore','pipe','pipe']});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});await new Promise((resolve,reject)=>{child.stdout.on('data',data=>{if(data.toString().includes('Studio listening'))resolve();});child.once('exit',()=>reject(Error('Fixture failed to start')));});child.kill('SIGTERM');assert.deepEqual(await exit,{code:0,signal:null});const db=new DatabaseSync(join(dir,'studio.sqlite'));try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
});
