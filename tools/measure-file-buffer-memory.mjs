// Synthetic SQLite/file buffers only: no server, accounts, credentials or network.
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
if(!['dedup-old','dedup-metadata','download-copy','download-view','upload-1','upload-2'].includes(process.argv[2])){
 for(const mode of ['dedup-old','dedup-metadata','download-copy','download-view','upload-1','upload-2']){const child=spawnSync(process.execPath,['--expose-gc',new URL(import.meta.url).pathname,mode],{encoding:'utf8'});if(child.status!==0)throw Error(child.stderr||'Measurement failed');process.stdout.write(child.stdout);}process.exit(0);
}
if(process.argv[2].startsWith('upload-')){
 const {Readable}=await import('node:stream');const concurrent=Number(process.argv[2].slice(-1)),size=50*1024*1024;global.gc();const before=process.memoryUsage();let peak=before.arrayBuffers;
 const body=async()=>{const chunks=[];let count=0;for await(const chunk of Readable.from((async function*(){for(let i=0;i<size;i+=65536)yield Buffer.alloc(65536,97);})())){count+=chunk.length;if(count>50*1024*1024)throw Error('limit');chunks.push(chunk);peak=Math.max(peak,process.memoryUsage().arrayBuffers);}const bytes=Buffer.concat(chunks);peak=Math.max(peak,process.memoryUsage().arrayBuffers);return bytes;};
 const results=await Promise.all(Array.from({length:concurrent},body));console.log(JSON.stringify({mode:process.argv[2],syntheticFileMiB:50,concurrent,retainedBodyMiB:results.reduce((n,b)=>n+b.length,0)/1048576,peakArrayBuffersDeltaMiB:(peak-before.arrayBuffers)/1048576,maxRssKiB:process.resourceUsage().maxRSS,note:'Existing body reader reproduction only; no SQLite insert, not a leak test'}));process.exit(0);
}
const mode=process.argv[2],size=mode.startsWith('dedup')?20*1024*1024:10*1024*1024,db=new DatabaseSync(':memory:');db.exec('CREATE TABLE files(id TEXT PRIMARY KEY,bytes BLOB)');db.prepare('INSERT INTO files VALUES(?,zeroblob(?))').run('synthetic',size);global.gc();const before=process.memoryUsage();let row,transferred;
if(mode.startsWith('dedup'))row=db.prepare(mode==='dedup-old'?'SELECT * FROM files WHERE id=?':'SELECT id FROM files WHERE id=?').get('synthetic');
else{row=db.prepare('SELECT * FROM files WHERE id=?').get('synthetic');transferred=mode==='download-copy'?Buffer.from(row.bytes):Buffer.from(row.bytes.buffer,row.bytes.byteOffset,row.bytes.byteLength);}
const after=process.memoryUsage();console.log(JSON.stringify({mode,syntheticFileMiB:size/1048576,externalDeltaMiB:(after.external-before.external)/1048576,arrayBuffersDeltaMiB:(after.arrayBuffers-before.arrayBuffers)/1048576,rssDeltaMiB:(after.rss-before.rss)/1048576,maxRssKiB:process.resourceUsage().maxRSS,id:row.id,transferBytes:transferred?.length||0}));db.close();
