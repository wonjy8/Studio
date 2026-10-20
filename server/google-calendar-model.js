import {createHash} from 'node:crypto';
import {calendarEvents,validDate,minutes,addDays} from '../src/domain/calendar.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const calendarFingerprint=value=>hash(JSON.stringify(value));
export function calendarTimeZone(value){if(typeof value!=='string'||value.length>100)throw Error('시간대를 확인하세요.');try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value;}catch{throw Error('IANA 시간대를 선택하세요.');}}
export function projectCalendarEvents(project,{uid,subject,timeZone}){
 calendarTimeZone(timeZone);const events=[],skipped=[];
 for(const source of calendarEvents(project)){
  if(!validDate(source.date)){skipped.push({id:source.id,reason:'날짜 없음'});continue;}
  const sourceHash=hash(JSON.stringify([uid,subject,project.project.id,source.type,source.id]));let start,end;
  if(!source.time?.trim()){start={date:source.date};end={date:addDays(source.date,1)};}
  else{
   const parts=source.time.trim().split(/\s*[–—~\-]\s*/),begin=minutes(parts[0]);if(begin===null||parts.length>2){skipped.push({id:source.id,reason:'시간 형식 확인 필요'});continue;}
   let finish=parts.length>1?minutes(parts[1]):begin+60;if(finish===null){skipped.push({id:source.id,reason:'종료 시간 확인 필요'});continue;}
   const nextDay=finish<=begin||finish>=1440;if(finish>=1440)finish-=1440;
   const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')+':00';
   start={dateTime:source.date+'T'+clock(begin),timeZone};end={dateTime:(nextDay?addDays(source.date,1):source.date)+'T'+clock(finish),timeZone};
  }
  const shoot=source.type==='shoot'?project.contents.find(item=>item.id===source.id):null;
  const body={summary:(project.project.name+' · '+source.name).slice(0,2000),location:shoot?.location|| (shoot?project.project.location||'':''),description:'Studio 프로젝트 일정입니다. 원본 일정은 Studio에서 수정해 주세요.',start,end,extendedProperties:{private:{studioSourceHash:sourceHash}}};
  events.push({projectId:project.project.id,type:source.type,sourceId:source.id,eventId:'studio'+sourceHash,body,fingerprint:calendarFingerprint(body)});
 }
 return {events,skipped};
}
export function calendarRange(start,end,timeZone='UTC'){
 if(!validDate(start)||!validDate(end)||end<=start||(Date.parse(end)-Date.parse(start))>93*86400000)throw Error('조회 기간은 1~93일로 선택하세요.');calendarTimeZone(timeZone);
 const boundary=date=>{const [year,month,day]=date.split('-').map(Number),target=Date.UTC(year,month-1,day);let guess=target;const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(let i=0;i<4;i++){const p=Object.fromEntries(format.formatToParts(new Date(guess)).map(item=>[item.type,item.value]));const actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);if(actual===target)return new Date(guess).toISOString();guess-=actual-target;}throw Error('조회 날짜의 시간대를 확인하세요.');};
 return {timeMin:boundary(start),timeMax:boundary(end)};
}
export function personalCalendarEvent(event){if(!event||event.status==='cancelled'||typeof event.id!=='string'||(event.start?.date?!validDate(event.start.date):!Number.isFinite(Date.parse(event.start?.dateTime))))return null;const link=typeof event.htmlLink==='string'&&/^https:\/\/(?:www\.google\.com|calendar\.google\.com)\//.test(event.htmlLink)?event.htmlLink:null;return {id:event.id,title:String(event.summary||'제목 없음').slice(0,2000),location:String(event.location||'').slice(0,2000),start:event.start,end:event.end,allDay:Boolean(event.start.date),recurring:Boolean(event.recurringEventId),url:link};}
