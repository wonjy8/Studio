import {createHash} from 'node:crypto';
import {readWorkspace} from './workspace-service.js';
import {projectCalendarEvents,calendarFingerprint,calendarTimeZone} from './google-calendar-model.js';
import {validDate,addDays,calendarEvents} from '../src/domain/calendar.js';
import {wallInstant} from './calendar-event-edit.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const schoolCalendarProjectId='workspace:school';
export const homeCalendarProjectId='workspace:home';
export function workspaceSource(db,uid,workspaceId){
 if(workspaceId==='school'){const row=db.prepare('SELECT body FROM school_workspaces WHERE user_id=?').get(uid),school=row?JSON.parse(row.body):{courses:[],semesters:[]};return {project:{id:schoolCalendarProjectId,name:'학교'},contents:school.courses.flatMap(c=>c.events.map(e=>({...e,time:e.endTime?e.time+'–'+e.endTime:e.time,name:c.name+' · '+e.name}))),tasks:school.courses.flatMap(c=>c.tasks.map(e=>({...e,name:c.name+' · '+e.name}))),schedule:[],workspaceId};}
 if(workspaceId==='home')return {project:{id:homeCalendarProjectId,name:'홈'},contents:[],tasks:[],schedule:[],workspaceId,homeEvents:db.prepare('SELECT id,body,revision FROM workspace_home_events WHERE user_id=? AND deleted=0').all(uid).map(row=>({id:row.id,...JSON.parse(row.body),revision:row.revision}))};
 if(typeof workspaceId==='string'&&workspaceId.startsWith('project:')){const id=workspaceId.slice(8),state=readWorkspace(db,uid).state,project=[state,...state.projects||[]].find(p=>p.project.id===id&&!p.project.placeholder);if(project)return {...project,workspaceId};}
 throw Object.assign(Error('내 워크스페이스를 선택하세요. 공유 프로젝트 설정은 포함하지 않습니다.'),{status:403});
}
export function homeEventBody(values){
 if(!values||Array.isArray(values)||Object.keys(values).some(k=>!['title','location','allDay','start','end','timeZone'].includes(k))||typeof values.title!=='string'||!values.title.trim()||values.title.length>2000||typeof values.location!=='string'||values.location.length>2000||typeof values.allDay!=='boolean'||typeof values.start!=='string'||typeof values.end!=='string')throw Error('일정 내용을 확인하세요.');
 const timeZone=calendarTimeZone(values.timeZone);let start,end;if(values.allDay){if(!validDate(values.start)||!validDate(values.end)||values.end<values.start)throw Error('종일 일정의 날짜를 확인하세요.');start={date:values.start};end={date:addDays(values.end,1)};}else{start={dateTime:wallInstant(values.start,timeZone),timeZone};end={dateTime:wallInstant(values.end,timeZone),timeZone};if(Date.parse(end.dateTime)<=Date.parse(start.dateTime))throw Error('종료 시간은 시작 이후여야 합니다.');}
 return {summary:values.title,location:values.location,start,end};
}
export function workspacePublicationEvents(source,context){
 if(source.homeEvents){return {events:source.homeEvents.map(event=>{const {id,revision,...values}=event;const body=homeEventBody(values),sourceHash=hash([context.uid,context.subject,source.project.id,'home',id]);Object.assign(body,{description:'Studio 홈 일정입니다. 원본은 Studio에서 수정하세요.',extendedProperties:{private:{studioSourceHash:sourceHash}}});return {projectId:source.project.id,type:'home',sourceId:event.id,eventId:'studio'+sourceHash,body,fingerprint:calendarFingerprint(body)};}),skipped:[]};}
 return projectCalendarEvents(source,context);
}

// Source identity is independent of whether date/time payload conversion succeeds.
export function workspaceSourceIdentities(source,{uid,subject}){const entries=source.homeEvents?source.homeEvents.map(event=>({id:event.id,type:'home',date:event.start.slice(0,10)})):calendarEvents(source);return entries.map(event=>({projectId:source.project.id,type:event.type,sourceId:event.id,date:event.date,eventId:'studio'+hash([uid,subject,source.project.id,event.type,event.id])}));}
export function workspaceSourceKeys(source){const records=source.homeEvents?source.homeEvents.map(event=>['home',event.id]):[...(source.contents||[]).map(event=>['shoot',event.id]),...(source.tasks||[]).map(event=>['task',event.id])];return new Set(records.map(record=>JSON.stringify(record)));}
