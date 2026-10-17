import {emptyWorkspace} from './workspace.js';
import {prepareProjects,allProjects,switchProject,addProject} from './projects.js';
import {addCamera,addLayoutObject,moveLayoutItem} from './layout.js';
export const commandOperations=['add_shoot','update_shoot','add_member','update_member','add_equipment','update_equipment','add_reference','update_reference','update_project','add_project','add_camera','add_layout_object','move_layout'];
const allowed={shoot:['name','time','location','status','completed'],member:['name','role','call'],equipment:['name','category','owner','assignee','status'],reference:['name','notes'],project:['name','date','time','location','icon','color']};
export function applyCommands(input,projectId,commands){
 if(!Array.isArray(commands)||commands.length<1||commands.length>20)throw Error('변경은 한 번에 1~20개까지 가능합니다.');
 let state=prepareProjects(structuredClone(input||emptyWorkspace()));
 const initial=state.project.id;state=switchProject(state,projectId);
 const impact=[];
 for(const command of commands){
  if(!command||!commandOperations.includes(command.operation)||!command.values||typeof command.values!=='object'||Array.isArray(command.values))throw Error('지원하지 않는 변경입니다.');
  const {operation,entityId,values}=command;
  if(operation==='add_project'){state=addProject(state,values,'project-'+crypto.randomUUID());impact.push('새 프로젝트: '+state.project.name);continue;}
  if(operation==='add_camera'){addCamera(state,values);impact.push('카메라 추가: '+values.name);continue;}
  if(operation==='add_layout_object'){const item=addLayoutObject(state,values);impact.push('배치 추가: '+item.name);continue;}
  if(operation==='move_layout'){moveLayoutItem(state,entityId,values.x,values.y,values.rotation);impact.push('배치 위치 변경');continue;}
  const type=operation.replace(/^(add|update)_/,'');
  const fields=allowed[type];if(!fields||Object.keys(values).some(k=>!fields.includes(k)))throw Error('허용하지 않는 필드입니다.');
  if(type==='project'){if(values.name!==undefined&&(typeof values.name!=='string'||!values.name.trim()))throw Error('프로젝트 이름이 필요합니다.');Object.assign(state.project,values);impact.push('프로젝트 정보 변경');continue;}
  const key={shoot:'contents',member:'members',equipment:'gear',reference:'refs'}[type];
  let item,previousName;
  if(operation.startsWith('add_')){
   if(state[key].length>=2000)throw Error('항목 개수 제한에 도달했습니다.');
   const defaults={shoot:{name:'',time:'',location:'',status:'check',script:false},member:{name:'',role:'',call:''},equipment:{name:'',owner:'',assignee:'',category:'other',status:'check'},reference:{name:'',notes:'',images:[]}}[type];
   item={...defaults,...values,id:type+'-'+crypto.randomUUID()};state[key].push(item);
  }else{item=state[key].find(x=>x.id===entityId);if(!item)throw Error('현재 프로젝트에서 항목을 찾을 수 없습니다.');previousName=item.name;Object.assign(item,values);}
  if(typeof item.name!=='string'||!item.name.trim())throw Error('이름이 필요합니다.');
  if(previousName&&previousName!==item.name){
   if(type==='member'){
    for(const gear of state.gear)for(const key of ['owner','assignee'])if(gear[key]===previousName)gear[key]=item.name;
    for(const camera of state.cameras)if(camera.operator===previousName)camera.operator=item.name;
    for(const object of state.layoutObjects)if(object.memberId===item.id&&object.name===previousName)object.name=item.name;
    impact.push('연결된 장비 소유자·담당자와 카메라 담당자 이름도 반영');
   }
   if(type==='equipment'){
    for(const camera of state.cameras)if(camera.gearId===item.id)camera.body=item.name;
    for(const object of state.layoutObjects)if(object.gearId===item.id&&object.name===previousName)object.name=item.name;
    impact.push('연결된 카메라 장비·배치 이름도 반영');
   }
  }
  if(type==='shoot'){
   const row=state.schedule.find(x=>x[2]===item.id);
   if(row){row[0]=item.time;row[1]=item.name;}else state.schedule.push([item.time,item.name,item.id]);
   state.schedule.sort((a,b)=>a[0].localeCompare(b[0]));
   if(operation==='update_shoot'&&values.time!==undefined)impact.push('일정 시간 변경: '+item.name+' (인원·장비 충돌은 별도 확인 필요)');
  }
  impact.push((operation.startsWith('add_')?'추가: ':'수정: ')+item.name);
 }
 if(state.project.id!==initial&&allProjects(state).some(p=>p.project.id===initial))state=switchProject(state,initial);
 return {state,impact};
}
