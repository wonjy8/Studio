import {validGraduation,creditCategories,gradeChoices} from './school-graduation.js';
import {validSyllabus} from './school-syllabus.js';
import {validCoursePage} from './school-course-page.js';
import {validDocuments} from './documents.js';
import {validDate,minutes,eventTime} from './calendar.js';
export const schoolViews=['school','school-semesters','school-tasks','school-schedule','school-requirements'];
// Accepted only to preserve existing stored records; no UI or calculation uses these values.
const legacyCourseStatuses=new Set(['planned','progress','completed','failed','withdrawn']);
export const emptySchool=()=>({requiredCredits:null,semesters:[],courses:[]});
const identity=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const text=(v,max=200)=>typeof v==='string'&&v.length<=max;
const credits=(v,max=1000)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max&&Math.abs(v*100-Math.round(v*100))<1e-7;
const keys=(o,names)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>names.includes(k));
const date=v=>v===''||validDate(v),time=v=>v===''||minutes(v)!==null;
export function validSchool(value){
 if(!keys(value,['requiredCredits','semesters','courses','graduation'])||!(value.requiredCredits===null||credits(value.requiredCredits,100000))||!Array.isArray(value.semesters)||value.semesters.length>100||!Array.isArray(value.courses)||value.courses.length>1000)return false;
 if(!validGraduation(value.graduation,value.courses))return false;
 const ids=new Set(),terms=new Set();for(const term of value.semesters){if(!keys(term,['id','name'])||!identity(term.id)||ids.has(term.id)||!text(term.name)||!term.name.trim())return false;ids.add(term.id);terms.add(term.id);}
 for(const course of value.courses){if(!keys(course,['id','semesterId','name','credits','status','creditGroup','creditLinks','professor','category','page','syllabus','documentModified','documents','tasks','events','grade','creditCategory'])||!identity(course.id)||ids.has(course.id)||!terms.has(course.semesterId)||!text(course.name)||!course.name.trim()||!credits(course.credits)||(course.status!==undefined&&!legacyCourseStatuses.has(course.status))||!text(course.creditGroup,100)||!validDocuments(course.documents)||!Array.isArray(course.tasks)||course.tasks.length>1000||!Array.isArray(course.events)||course.events.length>1000)return false;if((course.professor!==undefined&&!text(course.professor,200))||(course.category!==undefined&&!['','major','general','elective'].includes(course.category))||!validSyllabus(course.syllabus)||!validCoursePage(course.page,course.documents)||(course.documentModified!==undefined&&(!course.documentModified||Array.isArray(course.documentModified)||typeof course.documentModified!=='object'||Object.entries(course.documentModified).some(([key,value])=>!identity(key)||typeof value!=='string'||!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value))))))return false;if(course.creditLinks!==undefined&&(!Array.isArray(course.creditLinks)||course.creditLinks.length>1000||new Set(course.creditLinks).size!==course.creditLinks.length||course.creditLinks.some(other=>other===course.id||!value.courses.some(c=>c.id===other))))return false;if(course.grade!==undefined&&!gradeChoices.includes(course.grade)||course.creditCategory!==undefined&&course.creditCategory!==''&&!creditCategories.some(k=>k.id===course.creditCategory))return false;ids.add(course.id);
 for(const doc of course.documents){if(ids.has(doc.id))return false;ids.add(doc.id);}
 for(const task of course.tasks){if(!keys(task,['id','name','completed','date','time'])||!identity(task.id)||ids.has(task.id)||!text(task.name,500)||!task.name.trim()||typeof task.completed!=='boolean'||!date(task.date)||!time(task.time)||(task.time&&!task.date))return false;ids.add(task.id);}
 for(const event of course.events){if(!keys(event,['id','name','date','time','endTime','location'])||!identity(event.id)||ids.has(event.id)||!text(event.name,500)||!event.name.trim()||!validDate(event.date)||!time(event.time)||(event.endTime!==undefined&&(event.endTime!==''&&(!event.time||(event.endTime!=='24:00'&&minutes(event.endTime)===null)||(event.endTime==='24:00'?1440:minutes(event.endTime))<=minutes(event.time))))||!text(event.location,500))return false;ids.add(event.id);}
 }return true;
}
// Legacy group labels stay intact; explicit course links supersede them only after editing.
export function schoolCreditGroups(school){
 const parent=new Map(school.courses.map(c=>[c.id,c.id]));const find=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;},join=(a,b)=>{if(parent.has(a)&&parent.has(b))parent.set(find(a),find(b));};const legacy=new Map();
 for(const c of school.courses){if(c.creditLinks!==undefined){for(const other of c.creditLinks)join(c.id,other);continue;}const key=c.creditGroup.trim().normalize('NFKC').toLocaleLowerCase();if(key){if(legacy.has(key))join(c.id,legacy.get(key));else legacy.set(key,c.id);}}
 const groups=new Map();for(const c of school.courses){const key=find(c.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c.id);}return [...groups.values()];
}
export function setCourseEquivalents(school,courseId,selected){
 const groups=schoolCreditGroups(school),allowed=new Set(school.courses.map(c=>c.id));if(!allowed.has(courseId)||selected.some(id=>id===courseId||!allowed.has(id)))throw Error('중복 과목을 확인하세요.');
 // Detach current course, then join selected equivalence groups transitively.
 const others=groups.map(group=>group.filter(id=>id!==courseId)).filter(group=>group.length),chosen=new Set(selected),merged=[courseId];const rest=[];
 for(const group of others){if(group.some(id=>chosen.has(id)))merged.push(...group);else rest.push(group);}rest.push(merged);
 for(const group of rest)for(const id of group)school.courses.find(c=>c.id===id).creditLinks=group.filter(other=>other!==id);
}
// Legacy status fields are preserved in stored courses, but never gate registered credits.
export function schoolCredits(school){
 const earned=schoolCreditGroups(school).reduce((total,ids)=>total+Math.max(0,...ids.map(id=>Math.round(school.courses.find(c=>c.id===id).credits*100))),0)/100;
 return {earned,required:school.requiredCredits,remaining:school.requiredCredits===null?null:Math.max(0,Math.round((school.requiredCredits-earned)*100)/100)};
}
export function schoolRows(school,type){return school.courses.flatMap(course=>course[type].map(item=>({item,course,semester:school.semesters.find(term=>term.id===course.semesterId)})));}
export function schoolCalendarEvents(school,courseId){return [...schoolRows(school,'events'),...schoolRows(school,'tasks').filter(row=>validDate(row.item.date))].filter(row=>!courseId||row.course.id===courseId).map(({item,course,semester})=>({id:item.id,schoolCourseId:course.id,schoolSemesterId:course.semesterId,allDay:item.allDay===undefined?!item.time:item.allDay===true,type:Object.hasOwn(item,'completed')?'task':'school',name:[semester.name,course.name,item.name].join(' · '),date:item.date,time:item.time,completed:!!item.completed,...eventTime(item.endTime?item.time+'–'+item.endTime:item.time)}));}
