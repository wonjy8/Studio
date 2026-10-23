import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {computeBinary,computeSourceHash} from '../src/media/compute-binary.js';
test('shipped compute WASM matches reviewed sources, has no imports and retains notices',async()=>{
 const bytes=await readFile(new URL('../src/media/'+computeBinary,import.meta.url)),hash=createHash('sha256').update(bytes).digest('hex');assert.match(computeBinary,new RegExp(hash.slice(0,12)));
 const module=await WebAssembly.compile(bytes);assert.deepEqual(WebAssembly.Module.imports(module),[]);
 const source=createHash('sha256');for(const path of ['compute-core/Cargo.toml','compute-core/Cargo.lock','compute-core/src/lib.rs','tools/build-compute.mjs'])source.update(path+'\0').update(await readFile(new URL('../'+path,import.meta.url)));assert.equal(source.digest('hex'),computeSourceHash);
 const notices=await readFile(new URL('../src/media/compute-licenses.txt',import.meta.url),'utf8');assert.match(notices,/flate2/);assert.match(notices,/serde_json/);assert.match(notices,/MIT/);
});
