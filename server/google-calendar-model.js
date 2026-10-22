import {createHash} from 'node:crypto';
import {calendarEvents,validDate,minutes,addDays} from '../src/domain/calendar.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const calendarFingerprint=value=>hash(JSON.stringify(value));
export function calendarTimeZone(value){if(typeof value!=='string'||value.length>100)throw Error('시간대를 확인하세요.');try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value;}catch{throw Error('IANA 시간대를 선택하세요.');}}
// Resolve wall times without relying on the server's local timezone. Reject DST
// gaps/folds rather than silently choosing a different instant for publication.
function wallInstants(date,hour,minute,second,timeZone){
 const [y,m,d]=date.split('-').map(Number),wall=Date.UTC(y,m-1,d,hour,minute,second),format=new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=instant=>{const p=Object.fromEntries(format.formatToParts(new Date(instant)).map(item=>[item.type,item.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);};
 const offsets=new Set([-36,0,36].map(hours=>{const instant=wall+hours*3600000;return parts(instant)-instant;}));
 return [...offsets].map(offset=>wall-offset).filter(instant=>parts(instant)===wall);
}
function googleDateTime(value,timeZone){
 if(typeof value!=='string'||!validDate(value.slice(0,10)))return null;
 if(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))return Number.isFinite(Date.parse(value))?value:null;
 const match=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/);
 if(!match||!timeZone||+match[2]>23||+match[3]>59||+match[4]>59)return null;
 try{const instants=wallInstants(match[1],+match[2],+match[3],+match[4],calendarTimeZone(timeZone));return instants.length===1?new Date(instants[0]+Number('0.'+(match[5]||'0'))*1000).toISOString():null;}catch{return null;}
}
export function projectCalendarEvents(project,{uid,subject,timeZone}){
 calendarTimeZone(timeZone);const events=[],skipped=[];
 for(const source of calendarEvents(project)){
  if(!validDate(source.date)){skipped.push({id:source.id,reason:'날짜 없음'});continue;}
  const sourceHash=hash(JSON.stringify([uid,subject,project.project.id,source.type,source.id]));let start,end;
  if(!source.time?.trim()){start={date:source.date};end={date:addDays(source.date,1)};}
  else{
   const parts=source.time.trim().split(/\s*[–—~\-]\s*/),begin=minutes(parts[0]);if(begin===null||parts.length>2){skipped.push({id:source.id,reason:'시간 형식 확인 필요'});continue;}
   let finish=parts.length>1?(parts[1]==='24:00'?1440:minutes(parts[1])):begin+60;if(finish===null){skipped.push({id:source.id,reason:'종료 시간 확인 필요'});continue;}
   const nextDay=finish<=begin||finish>=1440;if(finish>=1440)finish-=1440;
   const endDate=nextDay?addDays(source.date,1):source.date;
   if(wallInstants(source.date,Math.floor(begin/60),begin%60,0,timeZone).length!==1||wallInstants(endDate,Math.floor(finish/60),finish%60,0,timeZone).length!==1){skipped.push({id:source.id,name:source.name,reason:'시간대의 DST 전환으로 없거나 중복되는 시간'});continue;}
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
 if(!validDate(start)||!validDate(end)||end<=start||(Date.parse(end)-Date.parse(start))>93*86400000)throw Object.assign(Error('조회 기간은 1~93일로 선택하세요.'),{status:400});calendarTimeZone(timeZone);
 const boundary=date=>{const [year,month,day]=date.split('-').map(Number),target=Date.UTC(year,month-1,day);let guess=target;const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(let i=0;i<4;i++){const p=Object.fromEntries(format.formatToParts(new Date(guess)).map(item=>[item.type,item.value]));const actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);if(actual===target)return new Date(guess).toISOString();guess-=actual-target;}throw Error('조회 날짜의 시간대를 확인하세요.');};
 return {timeMin:boundary(start),timeMax:boundary(end)};
}
export function personalCalendarEvent(event){
 if(!event||event.status==='cancelled'||typeof event.id!=='string')return null;
 const allDay=Boolean(event.start?.date),start=allDay?(validDate(event.start.date)?{date:event.start.date}:null):(()=>{const dateTime=googleDateTime(event.start?.dateTime,event.start?.timeZone);return dateTime?{dateTime,...(event.start.timeZone?{timeZone:event.start.timeZone}:{})}:null;})();if(!start)return null;
 const endDateTime=googleDateTime(event.end?.dateTime,event.end?.timeZone||event.start?.timeZone),end=allDay?(validDate(event.end?.date)?{date:event.end.date}:undefined):endDateTime?{dateTime:endDateTime,...(event.end.timeZone?{timeZone:event.end.timeZone}:{})}:undefined;
 const link=typeof event.htmlLink==='string'&&/^https:\/\/(?:www\.google\.com|calendar\.google\.com)\//.test(event.htmlLink)?event.htmlLink:null;
 return {id:event.id,title:String(event.summary||'제목 없음').slice(0,2000),location:String(event.location||'').slice(0,2000),start,end,allDay,recurring:Boolean(event.recurringEventId),url:link};
}
