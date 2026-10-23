import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
for(const scenario of ['unchanged','success','rollback','missing-volume','repeat','failed-release','pull-failure']) test(`NAS updater: ${scenario}`,()=>{
 const dir=mkdtempSync(join(tmpdir(),'studio-updater-'));
 try {
  const bin=join(dir,'bin');mkdirSync(bin);
  const config=join(dir,'compose.yaml');writeFileSync(config,'services: {}\n');
  const script=readFileSync('deploy/nas-auto-update.sh','utf8').replace('PATH=/var/packages','PATH="$TEST_BIN":/var/packages');
  writeFileSync(join(dir,'update.sh'),script);
  writeFileSync(join(bin,'docker'),`#!/usr/bin/env node
const fs=require('node:fs'),p=require('node:path');
const a=process.argv.slice(2),d=process.env.STUDIO_PROJECT_DIR,s=process.env.SCENARIO;
fs.appendFileSync(p.join(d,'calls'),JSON.stringify(a)+'\\n');
const applied=fs.existsSync(p.join(d,'applied'));
if(a[0]==='inspect'){
 const f=a[2];
 if(f.includes('config_files')) console.log(p.join(d,'compose.yaml')+(s==='repeat'?','+p.join(d,'.studio-update.override.yaml'):''));
 else if(f.includes('com.docker.compose.project')) console.log('studio');
 else if(f.includes('Mounts')) console.log(s==='missing-volume'?'':'true');
 else if(f.includes('.Image')) console.log('sha256:old');
 else if(f.includes('Health')) console.log(s==='rollback'?'unhealthy':'healthy');
} else if(a[0]==='image'&&a[1]==='inspect') console.log(s==='unchanged'?'sha256:old':'sha256:new');
else if(a[0]==='pull'&&s==='pull-failure')process.exit(1);
else if(a[0]==='compose'&&a.includes('up')) fs.writeFileSync(p.join(d,'applied'),'yes');
` ,{mode:0o755});
  if(scenario==='failed-release')writeFileSync(join(dir,'.studio-update.failed-image'),'sha256:new\n');
  const run=spawnSync('sh',[join(dir,'update.sh')],{encoding:'utf8',env:{...process.env,TEST_BIN:bin,STUDIO_PROJECT_DIR:dir,SCENARIO:scenario}});
  assert.equal(run.status,['rollback','missing-volume','failed-release','pull-failure'].includes(scenario)?1:0,run.stderr);
  const calls=readFileSync(join(dir,'calls'),'utf8').trim().split('\n').map(JSON.parse);
  const updates=calls.filter(a=>a[0]==='compose'&&a.includes('up'));
  assert.equal(updates.length,scenario==='rollback'?2:['success','repeat'].includes(scenario)?1:0);
  for(const args of updates){assert.deepEqual(args.slice(-3),['-d','--no-deps','studio']);}
  if(scenario==='rollback')assert.match(readFileSync(join(dir,'.studio-update.override.yaml'),'utf8'),/studio-rollback:local/);
  if(scenario==='pull-failure')assert.equal(calls.some(a=>a[0]==='image'&&a[1]==='tag'),false);
  if(scenario==='repeat')assert.equal(updates[0].filter(x=>x.endsWith('.studio-update.override.yaml')).length,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
