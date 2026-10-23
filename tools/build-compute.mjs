import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='compute-core';
execFileSync(process.env.CARGO||'cargo',['build','--locked','--release','--target','wasm32-unknown-unknown','--manifest-path',root+'/Cargo.toml'],{stdio:'inherit',env:{...process.env,RUSTFLAGS:'-C link-arg=--max-memory=268435456'}});
const bytes=await readFile(root+'/target/wasm32-unknown-unknown/release/studio_compute.wasm'),name='compute-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.wasm';
const source=createHash('sha256');for(const path of [root+'/Cargo.toml',root+'/Cargo.lock',root+'/src/lib.rs','tools/build-compute.mjs'])source.update(path+'\0').update(await readFile(path));
await writeFile('src/media/'+name,bytes);await writeFile('src/media/compute-binary.js',`// Generated code asset only. No user content.\nexport const computeBinary=${JSON.stringify('./'+name)};\nexport const computeSourceHash=${JSON.stringify(source.digest('hex'))};\n`);
const metadata=JSON.parse(execFileSync(process.env.CARGO||'cargo',['metadata','--locked','--format-version','1','--manifest-path',root+'/Cargo.toml'],{encoding:'utf8'}));let notices='Studio compute core: MIT. Third-party software notices follow.\n';
for(const p of metadata.packages.filter(p=>p.source)){notices+='\n'+p.name+' '+p.version+' ('+p.license+')\n';const dir=p.manifest_path.slice(0,p.manifest_path.lastIndexOf('/'));for(const name of (await readdir(dir)).filter(name=>/^licen[cs]e|^copying/i.test(name))){try{notices+=await readFile(dir+'/'+name,'utf8');}catch{/* A directory is not a license file. */}}}
await writeFile('src/media/compute-licenses.txt',notices);console.log(JSON.stringify({asset:name,bytes:bytes.length}));
