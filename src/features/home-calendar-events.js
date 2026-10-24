import {openCalendarEventEditor} from './calendar-event-editor.js';
import {googleAccountRequest} from './google-account-selection.js';
import {calendarEventCache} from './calendar-event-cache.js';
import {dateKey} from '../domain/calendar.js';
export function editHomeCalendarEvent({id,trigger,onSaved,namespace,initial={},onInvalidated=()=>{},onLoaded=()=>{}}){
 const request=googleAccountRequest('calendar');let record,editContext,target,savedRecord,savedTarget;const newId=id||crypto.randomUUID(),targetKey={calendarId:'@home-targets',eventId:'create'},targetLease=calendarEventCache.detailLease(targetKey),cachedTarget=!id&&calendarEventCache.peekDetail(targetKey)?.calendarTarget,preview=id&&initial?.title?{...initial,source:'홈 일정',editorTitle:'일정 수정',allowAllDayToggle:true}:cachedTarget?{title:'',location:'',allDay:initial.allDay!==false,start:initial.start||initial.date||dateKey(),end:initial.end||initial.date||dateKey(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',source:'홈 일정',editorTitle:'일정 추가',allowAllDayToggle:true,calendarTarget:cachedTarget}:null;
 return openCalendarEventEditor({trigger,initial:preview,load:async()=>{
  const result=await request('workspace-events/home'+(id?'/'+id:'')).catch(error=>{if([401,403,404,409,410].includes(error.status))onInvalidated();throw error;});
  if(namespace&&result.accountId!==namespace){onInvalidated();throw Object.assign(Error('로그인 계정이 변경되었습니다. 새로고침하세요.'),{status:409});}
  editContext=result.editContext;
  if(!id){target=await request('google/calendar/home-targets');if(namespace&&target.accountId!==namespace)throw Object.assign(Error('로그인 계정이 변경되었습니다. 새로고침하세요.'),{status:409});calendarEventCache.putDetail(targetKey,{calendarTarget:target},targetLease);}
  record=id?result.event:{title:'',location:'',allDay:initial.allDay!==false,start:initial.start||initial.date||dateKey(),end:initial.end||initial.date||dateKey(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'};
  if(id)onLoaded(record);
  return {...record,source:'홈 일정',editorTitle:id?'일정 수정':'일정 추가',canEdit:true,allowAllDayToggle:true,...(!id?{calendarTarget:target}:{})};
 },save:async(values,model)=>{
  const calendarId=savedRecord?savedTarget:values.calendarId;if(savedRecord&&values.calendarId!==undefined&&values.calendarId!==savedTarget)throw Error('이미 저장된 일정의 대상은 이동하지 않습니다. 원래 대상을 사용하세요.');
  const updating=!!id||!!savedRecord,saved=await request('workspace-events/home'+(updating?'/'+(id||newId):''),{method:updating?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({editContext,...(!updating?{target:{editContext:target.editContext,calendarId},id:newId}:{revision:savedRecord?.revision||record.revision}),values:{title:values.title,location:values.location,allDay:values.allDay==='on',start:values.start,end:values.end,timeZone:record.timeZone}})});
  if(id)record=saved.event;
  if(!id){savedRecord=saved.event;savedTarget=calendarId;model.calendarTarget.locked=true;}
  if(!id&&calendarId!=='none')try{
   const synced=await request('google/calendar/home-targets/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({editContext:target.editContext})});
   const errors=(synced.workspaceErrors||[]).filter(e=>e.eventId===newId);if(errors.length)throw Error(errors.map(e=>e.error||e.message).join(' · '));
  }catch(error){await onSaved?.();throw Error('일정은 Studio에 저장됐지만 Google 게시를 완료하지 못했습니다. 입력을 보관하고 다시 저장해 주세요. '+error.message);}
  return saved;
 },...(id?{remove:()=>request('workspace-events/home/'+id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({editContext,revision:record.revision})})}:{}),onSaved});
}
