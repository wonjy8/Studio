// Publish only explicit, version-controlled public frontend files; never copy the checkout.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,rename,rm,mkdtemp,lstat} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function buildPages({root=resolve(fileURLToPath(new URL('..',import.meta.url))),output=join(root,'build/pages')}={}){
 root=resolve(root);output=resolve(output);if(output===root||!relative(root,output).startsWith('build/'))throw Error('Pages output must be a fresh directory under build/.');
 try{await lstat(output);throw Error('Pages output already exists; choose a new output directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const git=(...args)=>execFileSync('git',['-C',root,...args],{maxBuffer:32*1024*1024}),revision=git('rev-parse','HEAD').toString().trim();
 const rows=git('ls-tree','-rz','--full-tree','HEAD','--','src','pages').toString().split('\0').filter(Boolean).map(row=>{const [meta,path]=row.split('\t');return {mode:meta.split(' ')[0],path};});
 const assets=JSON.parse(git('show',revision+':pages/public-assets.json').toString());
 if(!Array.isArray(assets)||assets.length>5000||new Set(assets).size!==assets.length||assets.some(path=>typeof path!=='string'||path.split('/').some(part=>part==='.'||part==='..')||!(/^src\/[a-zA-Z0-9_./-]+\.(js|css|svg)$/.test(path)||/^src\/design-system\/(icons|emoji)\/[A-Z-]+LICENSE\.txt$/.test(path))))throw Error('Invalid public asset allowlist.');
 const selected=[...assets,'pages/index.html','pages/pages-status.css'].map(path=>{const row=rows.find(row=>row.path===path);if(!row)throw Error('Public asset missing from reviewed commit: '+path);return row;});
 if(selected.some(row=>!['100644','100755'].includes(row.mode)))throw Error('Symlink/submodule assets are not publishable.');
 await mkdir(dirname(output),{recursive:true});const stage=await mkdtemp(join(dirname(output),'.pages-stage-'));
 try{const files=[];for(const {path}of selected){const target=path.startsWith('pages/')?path.slice(6):path;await mkdir(dirname(join(stage,target)),{recursive:true});await writeFile(join(stage,target),git('show',revision+':'+path));files.push(target);}
 await writeFile(join(stage,'.nojekyll'),'');files.push('.nojekyll');files.push('public-files.json');const manifest={version:1,revision,mode:'static-only-backend-unavailable',files:files.sort()};await writeFile(join(stage,'public-files.json'),JSON.stringify(manifest,null,2)+'\n');await rename(stage,output);return manifest;
 }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const manifest=await buildPages({output:process.argv[2]?resolve(process.argv[2]):undefined});console.log(JSON.stringify(manifest,null,2));}
