let revision=0;
export async function request(path,options={}) {
  const response=await fetch(`/api/${path}`,{credentials:'same-origin',...options});
  const data=await response.json();
  if(!response.ok){const error=Error(response.status===401?'로그인이 필요합니다. 새로고침 후 로그인해 주세요.':response.status===409?'다른 화면에서 변경되었습니다. 현재 내용을 보관한 뒤 새로고침해 주세요.':data.error||'요청에 실패했습니다.');error.status=response.status;throw error;}
  return data;
}
// Ignored reads must not advance the revision and authorize a stale later save.
export async function loadWorkspace({accept=()=>true}={}){const data=await request('workspace');if(!accept())return null;revision=data.revision;return data.state;}
export async function saveWorkspace(state){const data=await request('workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision})});revision=data.revision;return data.state;}
export async function saveEquipmentAssignments(projectId,gearId,values){const data=await request(`projects/${encodeURIComponent(projectId)}/equipment/${encodeURIComponent(gearId)}/assignments`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,values})});revision=data.revision;return data.state;}
export async function upload(file){return request('files',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});}
