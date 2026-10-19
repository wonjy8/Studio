import {validSchedule,validDate} from './calendar.js';
import {gearCategories,lightingTypes,layoutKinds,validTableGeometry} from './layout.js';
import {projectIconIds} from '../design-system/icons/catalog.js';
export const projectIcons=projectIconIds;
import {identityColors} from './colors.js';
export const projectColors=identityColors;
export function emptyWorkspace() {
  return {project:{name:'새 프로젝트',date:'',time:'',location:''},contents:[],schedule:[],members:[],gear:[],cameras:[],layoutObjects:[],refs:[],tasks:[],settings:{aiConnected:false,provider:''}};
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
 return [value,...(value.projects||[])].flatMap(p=>[...p.refs.flatMap(r=>r.images.map(s=>s.split('/').pop())),...p.refs.flatMap(r=>r.files||[]),...p.contents.map(s=>s.scriptFile).filter(Boolean)]);
}
function validateProject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const base = emptyWorkspace();
  if (Object.keys(value).some(k => !(k in base))) return false;
  const text = x => typeof x === 'string' && x.length <= 2000;
  const fields = (o, names) => o && names.every(k => text(o[k]));
  if (!fields(value.project,['name','date','time','location'])) return false;
  if(value.project.description!==undefined&&!text(value.project.description))return false;
  if(value.tasks!==undefined&&(!Array.isArray(value.tasks)||value.tasks.length>2000||!value.tasks.every(x=>x&&/^[a-zA-Z0-9_-]{1,80}$/.test(x.id)&&text(x.name)&&x.name.trim()&&typeof x.completed==='boolean'&&(x.shootId===undefined||(Array.isArray(value.contents)&&value.contents.some(shoot=>shoot&&shoot.id===x.shootId)))&&(x.flagged===undefined||typeof x.flagged==='boolean')&&validSchedule(x))||new Set(value.tasks.map(x=>x.id)).size!==value.tasks.length))return false;
  if(value.project.id!==undefined&&!/^[a-zA-Z0-9_-]{1,80}$/.test(value.project.id))return false;
  if(value.project.order!==undefined&&(!Number.isSafeInteger(value.project.order)||value.project.order<0))return false;
  if(value.project.icon!==undefined&&!projectIcons.includes(value.project.icon))return false;
  if(value.project.color!==undefined&&!projectColors.includes(value.project.color))return false;
  for (const k of ['contents','schedule','members','gear','cameras','refs']) {
    if (!Array.isArray(value[k]) || value[k].length > 2000) return false;
  }
  if(value.layoutObjects!==undefined&&(!Array.isArray(value.layoutObjects)||value.layoutObjects.length>2000))return false;
  const ids = new Set();
  for (const k of ['contents','members','gear','cameras','refs']) for (const item of value[k]) {
    if (!item || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  for(const item of value.layoutObjects||[]){if(!item||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)||ids.has(item.id))return false;ids.add(item.id);}
  if(value.project.placeholder!==undefined&&typeof value.project.placeholder!=='boolean')return false;
  if(value.project.placeholder&&(value.project.name!=='새 프로젝트'||value.project.date||value.project.time||value.project.location||value.project.description||['contents','schedule','members','gear','cameras','refs','tasks','layoutObjects'].some(key=>value[key]?.length)))return false;
  const status = x => ['ready','check','problem'].includes(x);
  if (!value.contents.every(x => fields(x,['name','time','location']) && (x.date===undefined||x.date===''||validDate(x.date)) && status(x.status) && typeof x.script === 'boolean' && (x.completed === undefined || typeof x.completed === 'boolean') && (!x.scriptFile || /^[a-f0-9-]{36}$/.test(x.scriptFile)))) return false;
  for(const shoot of value.contents){
    if(shoot.configuration===undefined)continue;
    const c=shoot.configuration,idList=(list,items)=>Array.isArray(list)&&list.length<=2000&&new Set(list).size===list.length&&list.every(id=>typeof id==='string'&&items.some(item=>item.id===id));
    if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(key=>!['memberIds','gearIds','rentals','cameras','layoutObjects'].includes(key))||!idList(c.memberIds,value.members)||!idList(c.gearIds,value.gear)||!Array.isArray(c.rentals)||c.rentals.length>2000||!Array.isArray(c.cameras)||!Array.isArray(c.layoutObjects))return false;
    if(!c.rentals.every(g=>g&&g.isRental===true&&Object.keys(g).every(key=>['id','name','category','owner','assignee','status','isRental','quantity','catalogModelId','catalogModel'].includes(key))&&Number.isSafeInteger(g.quantity)&&g.quantity>=1&&g.quantity<=100000&&!value.gear.some(common=>common.id===g.id)))return false;
    const scope={...emptyWorkspace(),project:value.project,members:value.members.filter(m=>c.memberIds.includes(m.id)),gear:[...value.gear.filter(g=>c.gearIds.includes(g.id)),...c.rentals],cameras:c.cameras,layoutObjects:c.layoutObjects,refs:value.refs};
    if(!validateProject(scope))return false;
  }
  if (!value.members.every(x => fields(x,['name','role','call']) && (x.contactId===undefined||(typeof x.contactId==='string'&&/^[a-f0-9-]{36}$/.test(x.contactId))))) return false;
  if (!value.gear.every(x => fields(x,['name','owner','assignee']) && (x.catalogModelId===undefined||x.catalogModelId===null||(typeof x.catalogModelId==='string'&&/^[a-f0-9-]{36}$/.test(x.catalogModelId))) && (x.contactEquipmentId===undefined||(typeof x.contactEquipmentId==='string'&&/^[a-f0-9-]{36}$/.test(x.contactEquipmentId))) && (x.isRental===undefined||typeof x.isRental==='boolean') && status(x.status) && (x.category===undefined||Object.hasOwn(gearCategories,x.category)))) return false;
  if (!value.cameras.every(x => fields(x,['name','role','operator','body','lens']) && [x.x,x.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100) && (x.gearId===undefined||value.gear.some(g=>g.id===x.gearId&&g.category==='camera')) && Array.isArray(x.refs) && x.refs.every(id=>value.refs.some(r=>r.id===id)))) return false;
  if (!(value.layoutObjects||[]).every(x=>fields(x,['name'])&&(x.color===undefined||identityColors.includes(x.color))&&(x.kind!=='text'||Boolean(x.name.trim()))&&(x.kind==='text'?(x.background===undefined||x.background==='transparent'||(typeof x.background==='string'&&/^#[a-fA-F0-9]{6}$/.test(x.background))):x.background===undefined)&&(x.kind==='lighting'?Object.hasOwn(lightingTypes,x.lightType):x.lightType===undefined)&&validTableGeometry(x)&&Object.hasOwn(layoutKinds,x.kind)&&[x.x,x.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100)&&Number.isFinite(x.rotation)&&x.rotation>=0&&x.rotation<=360&&(['equipment','lighting'].includes(x.kind)?value.gear.some(g=>g.id===x.gearId&&(x.kind!=='lighting'||g.category==='lighting')):x.gearId===undefined)&&(x.memberId===undefined||(x.kind==='person'&&value.members.some(m=>m.id===x.memberId)))))return false;
  if (!value.refs.every(x => ['tags','collection'].every(key=>x[key]===undefined||text(x[key])) && (x.url===undefined||x.url===''||(()=>{try{return ['http:','https:'].includes(new URL(x.url).protocol)&&text(x.url);}catch{return false;}})()) && fields(x,['name','notes']) && (x.libraryId===undefined||/^[a-f0-9-]{36}$/.test(x.libraryId)) && (x.files===undefined||(Array.isArray(x.files)&&x.files.length<=100&&x.files.every(id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)))) && Array.isArray(x.images) && x.images.length+(x.files?.length||0) <= 100 && x.images.every(s=>typeof s==='string' && /^\/api\/files\/[a-f0-9-]{36}$/.test(s)))) return false;
  if (!value.schedule.every(x=>Array.isArray(x)&&x.length===3&&x.every(text))) return false;
  return value.settings && value.settings.aiConnected === false && value.settings.provider === '';
}
