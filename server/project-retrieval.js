import {allProjects} from '../src/domain/projects.js';
const production=project=>{const {settings,...data}=project;return data;};
const resultId=id=>'project:'+id;
export function projectDocument(state,origin,id){
 if(typeof id!=='string'||!id.startsWith('project:'))throw Error('Project result ID is required');
 const project=allProjects(state).find(p=>resultId(p.project.id)===id);if(!project)throw Error('Project not found');
 return {id,title:project.project.name,url:origin+'/?project='+encodeURIComponent(project.project.id),text:JSON.stringify(production(project))};
}
export function searchProjects(state,origin,query){
 if(typeof query!=='string'||query.length>2000)throw Error('Search query must be a string up to 2000 characters');
 const normalized=query.trim().toLocaleLowerCase();
 const listQuery=['','*','all','projects','project list','프로젝트','프로젝트 목록','전체 프로젝트'].includes(normalized);
 const words=[...new Set(normalized.split(/\s+/).filter(Boolean))];
 const projects=allProjects(state).filter(project=>{if(listQuery)return true;const haystack=JSON.stringify(production(project)).toLocaleLowerCase();return words.every(word=>haystack.includes(word));});
 return {results:projects.map(project=>({id:resultId(project.project.id),title:project.project.name,url:origin+'/?project='+encodeURIComponent(project.project.id)}))};
}
