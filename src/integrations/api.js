import {prepareImageUpload} from '../media/image-preview.js';
import {clearCalendarCache} from '../features/calendar-event-cache.js';
import {sampleUploadColors} from '../domain/material-colors.js';
let revision=0,mutationGeneration=0,pendingMutations=0,requestAccount=null;
let mutationQueue=Promise.resolve();
// All workspace-revision writes share one queue, including team-only changes.
function serializeMutation(run){
  mutationGeneration++;pendingMutations++;
  const result=mutationQueue.then(run).finally(()=>pendingMutations--);
  mutationQueue=result.catch(()=>{});
  return result;
}
function adoptMutation(data){
  if(!Number.isSafeInteger(data.revision)||data.revision<revision){const error=Error('서버 변경 버전을 확인하지 못했습니다.');error.code='INVALID_RESPONSE';throw error;}
  revision=data.revision;return data;
}
function revisionMutation(path,method,values){return serializeMutation(async()=>adoptMutation(await request(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,revision})})));}
export async function request(path,options={}) {
  const headers=new Headers(options.headers||{});if(requestAccount&&options.method&&!['GET','HEAD'].includes(options.method.toUpperCase())&&path!=='login')headers.set('X-Studio-Account',requestAccount);
  const response=await fetch(`/api/${path}`,{credentials:'same-origin',...options,headers:Object.fromEntries(headers)});
  let data;try{data=await response.json();}catch{const error=Error('서버 응답을 확인하지 못했습니다.');error.status=response.status;error.code='INVALID_RESPONSE';throw error;}
  if(response.status===401&&typeof window!=='undefined')await clearCalendarCache();
  if(!response.ok){const calendarDiagnostic=path.startsWith('google/calendar/')&&data?.calendarDiagnostic&&/^[A-Z_]{1,50}$/.test(data.calendarDiagnostic.code||'')?data.calendarDiagnostic:null;const error=Error(calendarDiagnostic?data.error:response.status===401?'로그인이 필요합니다. 새로고침 후 로그인해 주세요.':data?.error==='ACCOUNT_CHANGED'?'로그인 계정이 변경되었습니다. 현재 내용을 보관한 뒤 새로고침해 주세요.':response.status===409?'다른 화면에서 변경되었습니다. 현재 내용을 보관한 뒤 새로고침해 주세요.':data?.error||'요청에 실패했습니다.');error.status=response.status;if(calendarDiagnostic)error.calendarDiagnostic=calendarDiagnostic;error.code=calendarDiagnostic?.code||(typeof data?.error==='string'?data.error:undefined);throw error;}
  if(typeof window!=='undefined'&&options.method==='POST'&&['logout','google/calendar/disconnect','google/unified/disconnect','google/calendar/connect','google/unified/connect'].includes(path))await clearCalendarCache();
  if(path==='session'&&data.account?.id&&!requestAccount)requestAccount=data.account.id;if(path==='logout')requestAccount=null;
  return data;
}
// Ignored reads must not advance the revision and authorize a stale later save.
export async function loadWorkspace({accept=()=>true}={}){const generation=mutationGeneration,writing=pendingMutations>0,data=await request('workspace');if(!accept()||writing||pendingMutations||generation!==mutationGeneration)return null;revision=data.revision;return data.state;}
export async function saveWorkspace(state){const data=await revisionMutation('workspace','PUT',{state:structuredClone(state)});return data.state;}
export async function saveEquipmentAssignments(projectId,gearId,values){const data=await revisionMutation(`projects/${encodeURIComponent(projectId)}/equipment/${encodeURIComponent(gearId)}/assignments`,'PUT',{values:structuredClone(values)});return data.state;}
export function createProjectTeam(projectId,name){return revisionMutation(`projects/${encodeURIComponent(projectId)}/teams`,'POST',{name});}
export function saveProjectMemberTeams(projectId,memberId,teamIds){return revisionMutation(`projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}/teams`,'PUT',{teamIds:[...teamIds]});}
export async function storeImagePreviews(fileId,prepared){
 if(!prepared.preview||!prepared.reference)return false;
 const sizes=new ArrayBuffer(8),view=new DataView(sizes);view.setUint32(0,prepared.preview.size,true);view.setUint32(4,prepared.reference.size,true);
 await request('files/'+encodeURIComponent(fileId)+'/preview',{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Thumbnail-Type':prepared.preview.type,'X-Reference-Type':prepared.reference.type},body:new Blob([sizes,prepared.preview,prepared.reference])});
 return true;
}
export async function upload(file,{signal,accept=()=>true}={}){
 const prepared=await prepareImageUpload(file,{signal}),colors=await sampleUploadColors(prepared.preview?new File([prepared.preview],file.name,{type:prepared.preview.type}):file);
 if(!accept()||signal?.aborted)throw new DOMException('업로드 화면이 닫혔습니다.','AbortError');
 const saved=await request('files',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),...(colors?{'X-Material-Colors':JSON.stringify(colors)}:{})},body:file,signal});
 if(!accept()||signal?.aborted)return saved;
 if(prepared.preview&&prepared.reference){try{saved.previewStored=await storeImagePreviews(saved.id,prepared);}catch{saved.previewStored=false;saved.retryPreviews=()=>storeImagePreviews(saved.id,prepared);}}
 return saved;
}

export function addProjectParticipants(projectId,userIds,organizationIds,contactIds=[]){return revisionMutation(`projects/${encodeURIComponent(projectId)}/member-selection`,'POST',{userIds:[...userIds],organizationIds:[...organizationIds],contactIds:[...contactIds]});}

export function addProjectContacts(projectId,contactIds){return revisionMutation(`projects/${encodeURIComponent(projectId)}/contact-selection`,'POST',{contactIds:[...contactIds]});}

export function linkProjectReferences(projectId,referenceIds){return revisionMutation(`projects/${encodeURIComponent(projectId)}/reference-library`,'POST',{referenceIds:[...referenceIds]});}
export function unlinkProjectReference(projectId,referenceId){return revisionMutation(`projects/${encodeURIComponent(projectId)}/reference-library/${encodeURIComponent(referenceId)}`,'DELETE',{});}

export const getWorkspaceRevision=()=>revision;
