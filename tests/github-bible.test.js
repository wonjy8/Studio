import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {githubBibleSource} from '../server/github-bible.js';
import {fixtureZip} from '../tools/qa-scripture-fixtures.mjs';
const zip=fixtureZip({'NIV.csv':'구절,구약·신약,본문,성경,장,절\n창세기 1:1,구약,Fictional English text,창세기,1,1\n'}),sha=createHash('sha1').update('blob '+zip.length+'\0').update(zip).digest('hex'),revision='a'.repeat(40);
const fixture=({bad=false}={})=>{let calls=[];const source=githubBibleSource({token:'fictional-readonly',fetcher:async(url,options)=>{calls.push(url);assert.ok(url.startsWith('https://api.github.com/repos/wonjy8/Bible/'));assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer fictional-readonly');if(url.endsWith('/branches/main'))return Response.json({commit:{sha:revision}});if(url.includes('/git/trees/'))return Response.json({sha:'b'.repeat(40),tree:[{type:'blob',path:'NIV.zip',size:zip.length,sha:bad?'0'.repeat(40):sha}]});assert.ok(url.endsWith('?ref='+revision));return new Response(zip);}});return {source,calls};};
test('private repository ZIPs are authenticated, verified, parsed and cached without embedding scripture',async()=>{const {source,calls}=fixture();const [a,b]=await Promise.all([source.load(),source.load()]);assert.equal(a,b);assert.equal(a.versions[0].bible.name,'NIV.csv');assert.equal(a.versions[0].bible.verses[0].text,'Fictional English text');assert.equal(calls.length,3);await source.load();assert.equal(calls.length,3);});
test('missing credentials, private access failures and mismatched blob data do not import a source',async()=>{await assert.rejects(githubBibleSource({token:''}).load(),/연결/);await assert.rejects(githubBibleSource({token:'fictional',fetcher:async()=>new Response('',{status:404})}).load(),/권한/);await assert.rejects(fixture({bad:true}).source.load(),/검증/);});

test('a conflicting NIV does not block valid translations and reports its exact verse without verse text',async()=>{
 const bad=fixtureZip({'NIV.csv':'구절,구약·신약,본문,성경,장,절\n창세기 1:1,구약,First fictional text,창세기,1,1\n창세기 1:1,구약,Different fictional text,창세기,1,1\n'});
 const blobs={'NASB.zip':zip,'NIV.zip':bad};
 const entries=Object.entries(blobs).map(([path,bytes])=>({path,type:'blob',size:bytes.length,sha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')}));
 const source=githubBibleSource({token:'fictional',fetcher:async url=>url.endsWith('/branches/main')?Response.json({commit:{sha:revision}}):url.includes('/git/trees/')?Response.json({tree:entries,sha:'b'.repeat(40)}):new Response(blobs[decodeURIComponent(url.split('/contents/')[1].split('?')[0])])});
 const result=await source.load();assert.equal(result.versions.length,1);assert.equal(result.versions[0].bible.name,'NASB.csv');assert.equal(result.errors.length,1);assert.match(result.errors[0],/NIV.zip.*창세기 1:1/);assert.doesNotMatch(result.errors[0],/fictional text/);
});
