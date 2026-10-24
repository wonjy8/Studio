import {createHash} from 'node:crypto';
import {validDate} from '../src/domain/calendar.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\r\n\0]/.test(v);
const eventPath=(calendar,id)=>'/calendars/'+encodeURIComponent(calendar)+'/events/'+encodeURIComponent(id);
const point=p=>validDate(p?.date)?['date',p.date]:Number.isFinite(Date.parse(p?.dateTime))?['instant',new Date(p.dateTime).toISOString()]:null;
export function eventMoveFingerprint(raw){return createHash('sha256').update(JSON.stringify([raw.summary||'',raw.description||'',raw.location||'',point(raw.start),point(raw.end),raw.eventType||'default'])).digest('base64url');}
export function calendarMoveCapability(raw,calendar,list,scopes,{managed=false}={}){
 let reason='';if(managed)reason='Studio에서 게시한 일정은 원본 프로젝트에서 관리하세요.';else if(!calendar.canWrite||scopes.eventWrite!==true)reason='원본 캘린더와 기존 연결의 일정 쓰기 권한이 필요합니다.';else if(raw.organizer?.self!==true)reason='주최자 캘린더의 원본 일정만 이동할 수 있습니다.';else if(raw.eventType&&raw.eventType!=='default'||raw.locked||raw.privateCopy||raw.status==='cancelled')reason='이 유형의 일정은 Studio에서 이동하지 않습니다.';else if(raw.recurrence?.length||raw.recurringEventId||raw.originalStartTime)reason='반복 전체·개별 회차의 이동은 현재 지원하지 않습니다.';else if(raw.attendees?.length||raw.attendeesOmitted)reason='참석자가 있는 일정의 주최자 변경은 현재 지원하지 않습니다.';else if(!text(raw.etag,1024)||!text(raw.iCalUID,1024)||!point(raw.start)||!point(raw.end))reason='원본 식별자와 날짜 정보를 확인할 수 없습니다.';
 const targets=list.filter(c=>c.id!==calendar.id&&c.canWrite&&c.canReadEvents);if(!reason&&!targets.length)reason='같은 연결 계정으로 쓸 수 있는 다른 캘린더가 없습니다.';if(!reason&&targets.length>250)reason='대상 캘린더가 너무 많습니다. Google Calendar에서 직접 확인하세요.';
 return {canMove:!reason,reason,calendars:reason?[]:targets.map(c=>({id:c.id,name:c.name})),sourceCalendarId:calendar.id};
}
export function googleEventMoves({links,accountStore,accounts,calendars,api,sessionLive,guard,original,managed,moveApi=api,scopes,invalidate}){
 const running=new Map(),locks=new Map(),reconciling=new Map();
 const publicMove=row=>({requestId:row.request_id,canonicalId:row.canonical_id,status:row.status,sourceCalendarId:row.source_calendar_id,destination:row.destination,...(row.result?{result:JSON.parse(row.result)}:{}),message:row.error||'',updatedAt:row.updated_at});
 function checkIntent(row,account,data){if(row.subject!==account.subject||row.source_calendar_id!==data.calendarId||row.source_event_id!==data.eventId||row.destination!==data.destination||row.source_etag!==data.etag)throw fail('이동 요청 ID가 다른 원본 또는 대상에 사용되었습니다.',409);}
 async function reconcile(session,row){
  const key=session.user_id+':'+row.request_id;if(reconciling.has(key))return reconciling.get(key);
  const work=(async()=>{if(row.status==='complete'||row.status==='rejected')return row;const uid=session.user_id,grant=accountStore.all(uid,'calendar').find(a=>a.subject===row.subject);if(!grant)return links.markMove(uid,row.request_id,'uncertain','원래 Google 계정을 다시 연결한 뒤 결과를 확인하세요.');
   try{return await accountStore.run(uid,'calendar',grant.account_id,async()=>{const check=()=>{sessionLive(session);guard(uid,grant.generation);},list=await calendars(uid);check();if(!list.some(c=>c.id===row.source_calendar_id&&c.canReadEvents)||!list.some(c=>c.id===row.destination&&c.canReadEvents))return links.markMove(uid,row.request_id,'uncertain','원래 캘린더와 대상의 읽기 권한을 확인하세요.');
    const get=async(calendar,id)=>{try{return await api(uid,eventPath(calendar,id),{},check);}catch(error){if([404,410].includes(error.status))return null;throw error;}};
    const source=await get(row.source_calendar_id,row.source_event_id);check();let target=await get(row.destination,row.source_event_id);check();
    if(source&&source.status!=='cancelled')return links.markMove(uid,row.request_id,'uncertain','원본이 아직 원래 캘린더에 있습니다. 요청을 재전송하지 않습니다. Google에서 확인한 뒤 결과를 다시 조회하세요.');
    if(!target||target.status==='cancelled'){
     const result=await api(uid,'/calendars/'+encodeURIComponent(row.destination)+'/events?'+new URLSearchParams({iCalUID:row.i_cal_uid,showDeleted:'false',maxResults:'10'}),{},check);check();
     const candidates=(result.items||[]).filter(e=>e.status!=='cancelled'&&e.iCalUID===row.i_cal_uid&&e.organizer?.self===true&&eventMoveFingerprint(e)===row.fingerprint);
     if(result.nextPageToken||candidates.length!==1)return links.markMove(uid,row.request_id,'uncertain','이동된 원본을 하나로 확인하지 못했습니다. Google Calendar에서 확인하세요.');target=candidates[0];
    }
    if(!text(target.id,1024)||target.status==='cancelled'||target.iCalUID!==row.i_cal_uid||target.organizer?.self!==true||eventMoveFingerprint(target)!==row.fingerprint)return links.markMove(uid,row.request_id,'uncertain','대상의 원본 식별 정보가 일치하지 않습니다. 자동으로 연결을 바꾸지 않습니다.');
    check();const done=links.completeMove(uid,row.request_id,target.id);invalidate(uid);return done;
   });}catch(error){return links.markMove(uid,row.request_id,'uncertain',error.status===409?'Google 연결 또는 원본 위치가 변경되었습니다. 다시 확인하세요.':'이동 결과를 읽지 못했습니다. 연결 권한을 확인한 뒤 다시 조회하세요.');}
  })();reconciling.set(key,work);try{return await work;}finally{if(reconciling.get(key)===work)reconciling.delete(key);}
 }
 async function routes(input){const {path,url,req,session,json,readJson}=input;if(!['/api/google/calendar/event/move','/api/google/calendar/event/move-status','/api/google/calendar/event/moves'].includes(path))return false;sessionLive(session);const uid=session.user_id;
  if(path.endsWith('/moves')&&req.method==='GET'){const cursor=url.searchParams.get('cursor')||'';if(cursor&&!/^[a-f0-9-]{36}$/i.test(cursor))throw fail('이동 확인 페이지를 확인하세요.');const rows=links.listMoves(uid,cursor);json(200,{accountId:uid,moves:rows.slice(0,25).map(publicMove),nextCursor:rows.length>25?rows[24].request_id:null});return true;}
  if(path.endsWith('/move-status')&&req.method==='GET'){const id=url.searchParams.get('requestId');if(!text(id,80)||!/^[a-f0-9-]{36}$/i.test(id))throw fail('이동 요청을 확인하세요.');let row=links.receipt(uid,id);if(!row){if(running.has(uid+':'+id)){json(202,{move:{requestId:id,status:'pending',message:'요청을 확인하고 있습니다.'}});return true;}throw fail('이동 확인 기록을 찾을 수 없습니다.',404);}if(!running.has(uid+':'+id))row=await reconcile(session,row);sessionLive(session);json(200,{move:publicMove(row)});return true;}
  if(path!=='/api/google/calendar/event/move'||req.method!=='POST')throw fail('Method not allowed',405);
  const data=await readJson(16000);sessionLive(session);if(!data||Array.isArray(data)||Object.keys(data).some(k=>!['requestId','calendarId','eventId','destination','etag','editContext','confirm','confirmOrganizerChange'].includes(k))||!text(data.requestId,80)||!/^[a-f0-9-]{36}$/i.test(data.requestId)||!text(data.calendarId,1024)||!text(data.eventId,1024)||!text(data.destination,1024)||!text(data.etag,1024)||data.confirm!==true||data.confirmOrganizerChange!==true)throw fail('원본 이동과 주최자 변경을 직접 확인하세요.');
  const account=accounts(uid);if(!account)throw fail('원래 Google 계정을 연결하세요.',409);const key=uid+':'+data.requestId,old=links.receipt(uid,data.requestId);if(old){checkIntent(old,account,data);const row=running.has(key)?old:await reconcile(session,old);sessionLive(session);json(200,{move:publicMove(row)});return true;}
  const intent=JSON.stringify([account.subject,data.calendarId,data.eventId,data.destination,data.etag]),active=running.get(key);if(active){if(active!==intent)throw fail('같은 요청 ID를 다른 이동에 사용하지 않습니다.',409);json(202,{move:{requestId:data.requestId,status:'pending',message:'같은 이동을 처리하고 있습니다.'}});return true;}
  const lock=JSON.stringify([uid,account.subject,data.calendarId,data.eventId]);if(locks.has(lock))throw fail('이 원본의 다른 이동을 먼저 확인하세요.',409);running.set(key,intent);locks.set(lock,data.requestId);let receipt;
  try{
   const value=await original(session,data),list=await calendars(uid);value.check();const capability=calendarMoveCapability(value.raw,value.calendar,list,scopes(uid),{managed:managed(uid,account.subject,value.calendar.id,value.raw)});if(!capability.canMove)throw fail(capability.reason,403);if(!capability.calendars.some(c=>c.id===data.destination))throw fail('같은 Google 연결로 쓰기 가능한 다른 캘린더를 선택하세요.',403);
   let destinationOriginal=null;try{destinationOriginal=await api(uid,eventPath(data.destination,data.eventId),{},value.check);}catch(error){if(error.status!==404)throw error;}
   value.check();const destinationIdentity=links.identity(uid,account.subject,data.destination,data.eventId),sourceIdentity=links.identity(uid,account.subject,data.calendarId,data.eventId),knownDestination=links.find(uid,destinationIdentity);if(destinationOriginal&&!(destinationOriginal.status==='cancelled'&&knownDestination?.id===sourceIdentity))throw fail('대상에 같은 일정 ID가 이미 있습니다. 덮어쓰거나 합치지 않습니다.',409);if(knownDestination&&destinationIdentity!==sourceIdentity)throw fail('대상의 기존 원본 연결과 충돌합니다.',409);
   receipt=links.startMove(uid,account.subject,data.calendarId,data.eventId,data.requestId,{destination:data.destination,etag:data.etag,generation:account.generation,iCalUID:value.raw.iCalUID,fingerprint:eventMoveFingerprint(value.raw)});
   if(receipt.existing){sessionLive(session);json(202,{move:publicMove(receipt)});return true;}
   try{const moved=await moveApi(uid,eventPath(data.calendarId,data.eventId)+'/move?'+new URLSearchParams({destination:data.destination,sendUpdates:'none'}),{method:'POST',headers:{'If-Match':data.etag}},value.check);value.check();if(!text(moved.id,1024)||moved.iCalUID!==value.raw.iCalUID||moved.status==='cancelled')throw fail('이동 응답의 원본을 확인하지 못했습니다.',502);receipt=links.completeMove(uid,data.requestId,moved.id);invalidate(uid);}catch(error){const rejected=Boolean(error.calendarDiagnostic&&error.status>=400&&error.status<500&&error.status!==408);receipt=links.markMove(uid,data.requestId,rejected?'rejected':'uncertain',rejected?(error.status===412?'다른 화면에서 원본이 변경되어 이동하지 않았습니다. 다시 열어 확인하세요.':error.message):'이동 요청 결과가 확실하지 않습니다. 재전송하지 말고 결과를 확인하세요.');}
   sessionLive(session);json(receipt.status==='complete'?200:202,{move:publicMove(receipt)});return true;
  }finally{running.delete(key);if(locks.get(lock)===data.requestId)locks.delete(lock);}
 }
 return {routes,describe:(uid,account,calendar,raw,list)=>({...calendarMoveCapability(raw,calendar,list,scopes(uid),{managed:managed(uid,account.subject,calendar.id,raw)}),pending:links.activeMove(uid,links.identity(uid,account.subject,calendar.id,raw.id))?publicMove(links.activeMove(uid,links.identity(uid,account.subject,calendar.id,raw.id))):null})};
}
