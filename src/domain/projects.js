import {prepareLayout} from './layout.js';
import {emptyWorkspace,projectIcons,projectColors} from './workspace.js';
const keys=['project','contents','schedule','members','gear','cameras','layoutObjects','refs','settings'];
export function projectSnapshot(state){return structuredClone(Object.fromEntries(keys.map(k=>[k,state[k]])));}
export function prepareProjects(state){
 state.project.id ||= 'project-main';
 state.project.icon=projectIcons.includes(state.project.icon)?state.project.icon:'production';
 state.project.color=projectColors.includes(state.project.color)?state.project.color:'violet';
 state.project.order=Number.isSafeInteger(state.project.order)&&state.project.order>=0?state.project.order:0;
 state.projects ||= [];
 for(const project of [state,...state.projects])prepareLayout(project);
 return state;
}
export function allProjects(state){return [projectSnapshot(state),...(state.projects||[])];}
export function switchProject(state,id){
 if(state.project.id===id)return state;
 const selected=state.projects.find(p=>p.project.id===id);
 if(!selected)throw Error('Project not found');
 return {...structuredClone(selected),projects:[projectSnapshot(state),...state.projects.filter(p=>p.project.id!==id)]};
}
export function addProject(state,{name,icon,color},id){
 if(!name.trim()||state.projects.length>=99)throw Error('프로젝트 이름을 입력해 주세요. 프로젝트는 최대 100개입니다.');
 const next=emptyWorkspace();next.project={...next.project,id,name:name.trim(),icon,color,order:Math.max(...[state,...state.projects].map(p=>p.project.order||0))+1};
 return {...next,projects:[projectSnapshot(state),...state.projects]};
}
