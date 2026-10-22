import {validDocuments} from './documents.js';
import {validDate,minutes,eventTime} from './calendar.js';
export const schoolViews=['school','school-semesters','school-tasks','school-schedule'];
export const courseStatuses={planned:'수강 예정',progress:'수강 중',completed:'이수 완료',failed:'미이수·낙제',withdrawn:'수강 취소'};
export const emptySchool=()=>({requiredCredits:null,semesters:[],courses:[]});
const identity=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const text=(v,max=200)=>typeof v==='string'&&v.length<=max;
const credits=(v,max=1000)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max&&Math.abs(v*100-Math.round(v*100))<1e-7;
const keys=(o,names)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>names.includes(k));
const date=v=>v===''||validDate(v),time=v=>v===''||minutes(v)!==null;
export function validSchool(value){
 if(!keys(value,['requiredCredits','semesters','courses'])||!(value.requiredCredits===null||credits(value.requiredCredits,100000))||!Array.isArray(value.semesters)||value.semesters.length>100||!Array.isArray(value.courses)||value.courses.length>1000)return false;
 const ids=new Set(),terms=new Set();for(const term of value.semesters){if(!keys(term,['id','name'])||!identity(term.id)||ids.has(term.id)||!text(term.name)||!term.name.trim())return false;ids.add(term.id);terms.add(term.id);}
 for(const course of value.courses){if(!keys(course,['id','semesterId','name','credits','status','creditGroup','documents','tasks','events'])||!identity(course.id)||ids.has(course.id)||!terms.has(course.semesterId)||!text(course.name)||!course.name.trim()||!credits(course.credits)||!Object.hasOwn(courseStatuses,course.status)||!text(course.creditGroup,100)||!validDocuments(course.documents)||!Array.isArray(course.tasks)||course.tasks.length>1000||!Array.isArray(course.events)||course.events.length>1000)return false;ids.add(course.id);
 for(const doc of course.documents){if(ids.has(doc.id))return false;ids.add(doc.id);}
 for(const task of course.tasks){if(!keys(task,['id','name','completed','date','time'])||!identity(task.id)||ids.has(task.id)||!text(task.name,500)||!task.name.trim()||typeof task.completed!=='boolean'||!date(task.date)||!time(task.time)||(task.time&&!task.date))return false;ids.add(task.id);}
 for(const event of course.events){if(!keys(event,['id','name','date','time','location'])||!identity(event.id)||ids.has(event.id)||!text(event.name,500)||!event.name.trim()||!validDate(event.date)||!time(event.time)||!text(event.location,500))return false;ids.add(event.id);}
 }return true;
}
export function schoolCredits(school){const groups=new Map();for(const course of school.courses){const normalized=course.creditGroup.trim().normalize('NFKC').toLocaleLowerCase(),key=normalized?'group:'+normalized:'course:'+course.id;const group=groups.get(key)||{completed:0,progress:0,planned:0};if(['completed','progress','planned'].includes(course.status))group[course.status]=Math.max(group[course.status],Math.round(course.credits*100));groups.set(key,group);}let earned=0,inProgress=0,planned=0;for(const g of groups.values()){earned+=g.completed;inProgress+=Math.max(0,g.progress-g.completed);planned+=Math.max(0,g.planned-Math.max(g.completed,g.progress));}earned/=100;inProgress/=100;planned/=100;return {earned,inProgress,planned,required:school.requiredCredits,remaining:school.requiredCredits===null?null:Math.max(0,Math.round((school.requiredCredits-earned)*100)/100)};}
export function schoolRows(school,type){return school.courses.flatMap(course=>course[type].map(item=>({item,course,semester:school.semesters.find(term=>term.id===course.semesterId)})));}
export function schoolCalendarEvents(school,courseId){return [...schoolRows(school,'events'),...schoolRows(school,'tasks').filter(row=>validDate(row.item.date))].filter(row=>!courseId||row.course.id===courseId).map(({item,course,semester})=>({id:item.id,schoolCourseId:course.id,schoolSemesterId:course.semesterId,allDay:item.allDay===undefined?!item.time:item.allDay===true,type:Object.hasOwn(item,'completed')?'task':'school',name:[semester.name,course.name,item.name].join(' · '),date:item.date,time:item.time,completed:!!item.completed,...eventTime(item.time)}));}
