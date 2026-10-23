import {createHash} from 'node:crypto';
import {scriptureImportRunner} from './scripture-import-runner.js';
const origin='https://api.github.com/repos/wonjy8/Bible';
const failure=message=>Object.assign(Error(message),{status:503});
export function githubBibleSource({token=process.env.BIBLE_GITHUB_TOKEN||'',fetcher=fetch,now=Date.now,parseZip}={}){
 let snapshot=null,checked=0,pending=null,lastError=null,retryAt=0;
 const enabled=Boolean(token),ownParser=parseZip?null:scriptureImportRunner(),parse=parseZip||(bytes=>ownParser(()=>Promise.resolve(bytes)));
 async function get(path,raw=false){
  const response=await fetcher(origin+path,{headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Studio-Bible'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw failure(response.status===404||response.status===401||response.status===403?'성경 저장소 읽기 권한을 확인해 주세요.':'성경 저장소를 불러오지 못했습니다.');
  const reader=response.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>25*1024*1024){await reader.cancel();throw failure('성경 파일 크기가 너무 큽니다.');}chunks.push(Buffer.from(value));}const bytes=Buffer.concat(chunks);return raw?bytes:JSON.parse(bytes.toString('utf8'));
 }
 async function refresh(){
  const branch=await get('/branches/main'),revision=branch.commit?.sha;if(!/^[a-f0-9]{40}$/.test(revision||''))throw failure('성경 저장소 버전을 확인하지 못했습니다.');const tree=await get('/git/trees/'+revision+'?recursive=1');if(tree.truncated||!Array.isArray(tree.tree))throw failure('성경 저장소 파일 목록을 확인하지 못했습니다.');
  const files=tree.tree.filter(file=>file.type==='blob'&&/\.zip$/i.test(file.path)).sort((a,b)=>/새번역/.test(b.path.normalize('NFKC'))-/새번역/.test(a.path.normalize('NFKC'))||a.path.localeCompare(b.path));
  if(!files.length||files.length>10)throw failure('성경 저장소의 ZIP 파일 구성을 확인해 주세요.');
  if(snapshot?.revision===revision&&!snapshot.errors?.length){checked=now();return snapshot;}
  const versions=[],errors=[];for(const file of files){
   try{
   if(typeof file.path!=='string'||!Number.isSafeInteger(file.size)||file.size>25*1024*1024)throw failure('성경 저장소 파일 크기를 확인해 주세요.');
   const prior=snapshot?.versions.find(version=>version.fingerprint==='github:'+file.sha);if(prior){versions.push(prior);continue;}
   const bytes=await get('/contents/'+file.path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(revision),true);
   const digest=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');if(digest!==file.sha)throw failure('성경 저장소 파일 검증에 실패했습니다.');
   const {bible}=await parse(bytes);if(!bible)throw failure('성경 저장소에 지원하는 성경 CSV가 없습니다.');versions.push({bible:{...bible,name:file.path.replace(/\.zip$/i,'.csv')},fingerprint:'github:'+file.sha});
   }catch(error){errors.push(file.path+': '+([400,503].includes(error.status)?error.message:'파일 다운로드 또는 해석에 실패했습니다.'));}
  }
  if(!versions.length)throw failure(errors.join(' / '));
  snapshot={revision,versions,errors};checked=now();lastError=null;return snapshot;
 }
 async function load(){
  if(!enabled)throw failure('성경 저장소 연결이 필요합니다.');
  if(snapshot&&now()-checked<(snapshot.errors?.length?60000:15*60*1000))return snapshot;
  if(lastError&&now()<retryAt)throw lastError;
  if(!pending)pending=refresh().catch(error=>{lastError=failure(error.status===503?error.message:'성경 저장소를 불러오지 못했습니다.');retryAt=now()+60000;throw lastError;}).finally(()=>{pending=null;});
  return pending;
 }
 return {enabled,load,close:()=>ownParser?.close()};
}
