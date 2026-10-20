let revision=0,mutationGeneration=0,pendingMutations=0;
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
  const response=await fetch(`/api/${path}`,{credentials:'same-origin',...options});
  let data;try{data=await response.json();}catch{const error=Error('서버 응답을 확인하지 못했습니다.');error.status=response.status;error.code='INVALID_RESPONSE';throw error;}
  if(!response.ok){const error=Error(response.status===401?'로그인이 필요합니다. 새로고침 후 로그인해 주세요.':response.status===409?'다른 화면에서 변경되었습니다. 현재 내용을 보관한 뒤 새로고침해 주세요.':data?.error||'요청에 실패했습니다.');error.status=response.status;error.code=typeof data?.error==='string'?data.error:undefined;throw error;}
  return data;
}
// Ignored reads must not advance the revision and authorize a stale later save.
export async function loadWorkspace({accept=()=>true}={}){const generation=mutationGeneration,writing=pendingMutations>0,data=await request('workspace');if(!accept()||writing||pendingMutations||generation!==mutationGeneration)return null;revision=data.revision;return data.state;}
export async function saveWorkspace(state){const data=await revisionMutation('workspace','PUT',{state:structuredClone(state)});return data.state;}
export async function saveEquipmentAssignments(projectId,gearId,values){const data=await revisionMutation(`projects/${encodeURIComponent(projectId)}/equipment/${encodeURIComponent(gearId)}/assignments`,'PUT',{values:structuredClone(values)});return data.state;}
export function createProjectTeam(projectId,name){return revisionMutation(`projects/${encodeURIComponent(projectId)}/teams`,'POST',{name});}
export function saveProjectMemberTeams(projectId,memberId,teamIds){return revisionMutation(`projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}/teams`,'PUT',{teamIds:[...teamIds]});}
export async function upload(file){return request('files',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});}

export function addProjectParticipants(projectId,userIds,organizationIds,contactIds=[]){return revisionMutation(`projects/${encodeURIComponent(projectId)}/member-selection`,'POST',{userIds:[...userIds],organizationIds:[...organizationIds],contactIds:[...contactIds]});}

export function addProjectContacts(projectId,contactIds){return revisionMutation(`projects/${encodeURIComponent(projectId)}/contact-selection`,'POST',{contactIds:[...contactIds]});}

export function linkProjectReferences(projectId,referenceIds){return revisionMutation(`projects/${encodeURIComponent(projectId)}/reference-library`,'POST',{referenceIds:[...referenceIds]});}
export function unlinkProjectReference(projectId,referenceId){return revisionMutation(`projects/${encodeURIComponent(projectId)}/reference-library/${encodeURIComponent(referenceId)}`,'DELETE',{});}

export const getWorkspaceRevision=()=>revision;
