import {emptyShootConfiguration,shootConfiguration,shootLayout,pruneShootLayout,copyShoot} from './shoots.js';
import {emptyWorkspace} from './workspace.js';
import {prepareProjects,allProjects,switchProject,addProject} from './projects.js';
import {addCamera,addLayoutObject,moveLayoutItem} from './layout.js';
export const commandOperations=['add_shoot','update_shoot','add_member','update_member','add_equipment','update_equipment','add_reference','update_reference','update_project','add_project','add_camera','add_layout_object','move_layout','configure_shoot','copy_shoot','add_task','update_task'];
export const commandFields={shoot:['date','name','time','location','status','completed','script','scriptFile'],member:['name','role','call'],equipment:['catalogModelId','isRental','name','category','owner','assignee','status','ownerMemberId','assigneeMemberId'],reference:['name','notes','url','tags','collection'],task:['name','completed','flagged','shootId','date','time'],project:['name','description','date','time','location','icon','color']};
export function applyCommands(input,projectId,commands,{prepareLayout=true}={}){
 if(!Array.isArray(commands)||commands.length<1||commands.length>20)throw Error('변경은 한 번에 1~20개까지 가능합니다.');
 let state=prepareProjects(structuredClone(input||emptyWorkspace()),{layout:prepareLayout});
 const initial=state.project.id;state=switchProject(state,projectId);
 const impact=[];
 for(const command of commands){
  if(!command||!commandOperations.includes(command.operation)||!command.values||typeof command.values!=='object'||Array.isArray(command.values))throw Error('지원하지 않는 변경입니다.');
  const {operation,entityId,values,shootId}=command;
  if(Object.keys(command).some(key=>!['operation','entityId','values','shootId'].includes(key)))throw Error('지원하지 않는 명령 필드입니다.');
  const shoot=shootId===undefined?null:state.contents.find(item=>item.id===shootId);
  if(shootId!==undefined&&!shoot)throw Error('현재 프로젝트에서 촬영을 찾을 수 없습니다.');
  if(shootId!==undefined&&!['add_camera','add_layout_object','move_layout'].includes(operation))throw Error('이 명령은 values.shootId 또는 entityId를 사용하세요.');
  if(operation==='copy_shoot'){
   if(Object.keys(values).length)throw Error('복제할 촬영은 entityId로 지정하세요.');
   const copied=copyShoot(state,entityId);Object.assign(state,copied.project);impact.push('촬영 복제: '+copied.shoot.name);continue;
  }
  if(operation==='configure_shoot'){
   const target=state.contents.find(item=>item.id===entityId);if(!target)throw Error('현재 프로젝트에서 촬영을 찾을 수 없습니다.');
   if(!Object.keys(values).length||Object.keys(values).some(key=>!['memberIds','gearIds'].includes(key)))throw Error('촬영의 memberIds/gearIds를 지정하세요.');
   const config=shootConfiguration(state,target);
   for(const key of Object.keys(values)){const items=key==='memberIds'?state.members:state.gear;if(!Array.isArray(values[key])||new Set(values[key]).size!==values[key].length||values[key].some(id=>!items.some(item=>item.id===id&&!item.equipmentUnavailable)))throw Error('현재 프로젝트의 사용 가능한 항목을 선택하세요.');config[key]=[...values[key]];}
   target.configuration=pruneShootLayout(state,config);impact.push('촬영 인원·장비 선택 변경 (제외 항목에 연결된 배치도 제거): '+target.name);continue;
  }
  if(shoot){
   const config=shootConfiguration(state,shoot),scope=shootLayout(state,config);
   if(operation==='add_camera')addCamera(scope,values);
   else if(operation==='add_layout_object')addLayoutObject(scope,values);
   else moveLayoutItem(scope,entityId,values.x,values.y,values.rotation);
   config.cameras=scope.cameras;config.layoutObjects=scope.layoutObjects;shoot.configuration=config;
   impact.push('촬영 카메라·배치 변경: '+shoot.name);continue;
  }
  if(operation==='add_project'){state=addProject(state,values,'project-'+crypto.randomUUID());impact.push('새 프로젝트: '+state.project.name);continue;}
  if(operation==='add_camera'){addCamera(state,values);impact.push('카메라 추가: '+values.name);continue;}
  if(operation==='add_layout_object'){const item=addLayoutObject(state,values);impact.push('배치 추가: '+item.name);continue;}
  if(operation==='move_layout'){moveLayoutItem(state,entityId,values.x,values.y,values.rotation);impact.push('배치 위치 변경');continue;}
  const type=operation.replace(/^(add|update)_/,'');
  const fields=commandFields[type];if(!fields||Object.keys(values).some(k=>!fields.includes(k)))throw Error('허용하지 않는 필드입니다.');
  if(type==='project'){if(values.name!==undefined&&(typeof values.name!=='string'||!values.name.trim()))throw Error('프로젝트 이름이 필요합니다.');Object.assign(state.project,values);impact.push('프로젝트 정보 변경');continue;}
  const key={shoot:'contents',member:'members',equipment:'gear',reference:'refs',task:'tasks'}[type];
  let item,previousName,previousItem;
  if(operation.startsWith('add_')){
   if(state[key].length>=2000)throw Error('항목 개수 제한에 도달했습니다.');
   const defaults={task:{name:'',completed:false},shoot:{name:'',time:'',location:'',status:'check',script:false,configuration:emptyShootConfiguration()},member:{name:'',role:'',call:''},equipment:{name:'',owner:'',assignee:'',category:'other',status:'check',equipmentSource:'manual'},reference:{name:'',notes:'',images:[]}}[type];
   item={...defaults,...values,id:type+'-'+crypto.randomUUID()};state[key].push(item);
  }else{item=state[key].find(x=>x.id===entityId);if(!item)throw Error('현재 프로젝트에서 항목을 찾을 수 없습니다.');previousName=item.name;previousItem={...item};Object.assign(item,values);}
  if(typeof item.name!=='string'||!item.name.trim())throw Error('이름이 필요합니다.');
  if(type==='equipment'&&item.isRental!==undefined&&typeof item.isRental!=='boolean')throw Error('대여 장비 구분을 확인하세요.');
  if(type==='equipment')for(const field of ['owner','assignee']){
   const linkKey=field+'MemberId',memberId=item[linkKey];
   if(memberId!==undefined&&memberId!==null){
    if(typeof memberId!=='string')throw Error('현재 프로젝트의 멤버를 선택하세요.');
    const member=state.members.find(member=>member.id===memberId);if(!member)throw Error('현재 프로젝트의 멤버를 선택하세요.');item[field]=member.name;
   }else if(Object.hasOwn(values,linkKey)){
    if(values[linkKey]!==null)throw Error('멤버 연결 해제는 null을 사용하세요.');
    if(previousItem?.[linkKey]&&!Object.hasOwn(values,field))item[field]='';
   }
  }
  if(previousName&&previousName!==item.name){
   if(type==='member'){
    for(const gear of state.gear)for(const key of ['owner','assignee']){const linkKey=key+'MemberId';if(gear[linkKey]===item.id||(!Object.hasOwn(gear,linkKey)&&gear[key]===previousName))gear[key]=item.name;}
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
  if(type==='equipment'&&item.equipmentId){
   for(const project of [state,...(state.projects||[])])for(const gear of project.gear){
    if(gear===item||gear.equipmentId!==item.equipmentId)continue;
    const oldName=gear.name;
    for(const key of ['name','category'])if(Object.hasOwn(values,key))gear[key]=item[key];
    if(gear.name!==oldName){for(const camera of project.cameras)if(camera.gearId===gear.id)camera.body=gear.name;for(const object of project.layoutObjects)if(object.gearId===gear.id&&object.name===oldName)object.name=gear.name;}
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
