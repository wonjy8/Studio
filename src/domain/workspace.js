export const projectIcons=['production','play','book','camera','folder','sparkle'];
export const projectColors=['violet','blue','orange','green','rose','graphite'];
export function emptyWorkspace() {
  return {project:{name:'새 프로젝트',date:'',time:'',location:''},contents:[],schedule:[],members:[],gear:[],cameras:[],refs:[],settings:{aiConnected:false,provider:''}};
}
export function validateWorkspace(value) {
  if (!value || typeof value !== 'object') return false;
  const {projects,...current}=value;
  if (!validateProject(current)) return false;
  if(projects===undefined)return true;
  if(!Array.isArray(projects)||projects.length>99||!current.project.id)return false;
  const ids=new Set([current.project.id]);
  for(const project of projects){
    if(!validateProject(project)||!project.project.id||ids.has(project.project.id))return false;
    ids.add(project.project.id);
  }
  return true;
}
export function workspaceFileIds(value){
 return [value,...(value.projects||[])].flatMap(p=>[...p.refs.flatMap(r=>r.images.map(s=>s.split('/').pop())),...p.contents.map(s=>s.scriptFile).filter(Boolean)]);
}
function validateProject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const base = emptyWorkspace();
  if (Object.keys(value).some(k => !(k in base))) return false;
  const text = x => typeof x === 'string' && x.length <= 2000;
  const fields = (o, names) => o && names.every(k => text(o[k]));
  if (!fields(value.project,['name','date','time','location'])) return false;
  if(value.project.id!==undefined&&!/^[a-zA-Z0-9_-]{1,80}$/.test(value.project.id))return false;
  if(value.project.order!==undefined&&(!Number.isSafeInteger(value.project.order)||value.project.order<0))return false;
  if(value.project.icon!==undefined&&!projectIcons.includes(value.project.icon))return false;
  if(value.project.color!==undefined&&!projectColors.includes(value.project.color))return false;
  for (const k of ['contents','schedule','members','gear','cameras','refs']) {
    if (!Array.isArray(value[k]) || value[k].length > 2000) return false;
  }
  const ids = new Set();
  for (const k of ['contents','members','gear','cameras','refs']) for (const item of value[k]) {
    if (!item || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  const status = x => ['ready','check','problem'].includes(x);
  if (!value.contents.every(x => fields(x,['name','time','location']) && status(x.status) && typeof x.script === 'boolean' && (x.completed === undefined || typeof x.completed === 'boolean') && (!x.scriptFile || /^[a-f0-9-]{36}$/.test(x.scriptFile)))) return false;
  if (!value.members.every(x => fields(x,['name','role','call']))) return false;
  if (!value.gear.every(x => fields(x,['name','owner','assignee']) && status(x.status))) return false;
  if (!value.cameras.every(x => fields(x,['name','role','operator','body','lens']) && [x.x,x.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100) && Array.isArray(x.refs) && x.refs.every(id=>value.refs.some(r=>r.id===id)))) return false;
  if (!value.refs.every(x => fields(x,['name','notes']) && Array.isArray(x.images) && x.images.length <= 100 && x.images.every(s=>typeof s==='string' && /^\/api\/files\/[a-f0-9-]{36}$/.test(s)))) return false;
  if (!value.schedule.every(x=>Array.isArray(x)&&x.length===3&&x.every(text))) return false;
  return value.settings && value.settings.aiConnected === false && value.settings.provider === '';
}
