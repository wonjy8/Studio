import {bindEditAutosave} from './edit-autosave.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
let active=null;
export const calendarEditorCanLeave=()=>!active?.isConnected;
// Cached models are display-only. A fresh load supplies all write authority.
export async function openCalendarEventEditor({load,save,onSaved,trigger,remove,initial=null,provider='native'}){
 if(active?.isConnected)return;
 const dialog=document.createElement('dialog');active=dialog;dialog.className='project-member-picker school-dialog calendar-event-editor';dialog.setAttribute('aria-label','일정 수정');
 dialog.innerHTML='<header class="school-dialog-header"><h2>일정 수정</h2></header><div class="school-dialog-body"><div aria-busy="true" data-calendar-initial-placeholder></div></div><footer class="school-dialog-footer"><button class="btn" data-event-close>취소</button></footer>';
 document.body.append(dialog);
 let busy=false,autosaved=false,model=null,validated=false,loading=false,autosave=null,dirty=false;
 const lifetime=new AbortController(),live=()=>dialog.isConnected&&active===dialog;
 const dispose=()=>{autosave?.abandon();lifetime.abort();dialog.close();dialog.remove();if(active===dialog)active=null;};
 const close=(saved=false)=>{if(busy)return;if(!saved&&dirty&&!autosave&&!confirm('저장하지 않은 일정 변경을 닫을까요?'))return;dispose();if(autosaved)void onSaved?.();if(trigger?.isConnected)trigger.focus({preventScroll:true});else document.querySelector('[data-workspace-calendar]')?.focus({preventScroll:true});};
 window.addEventListener('studio:calendar-cache-clear',event=>{if(provider==='google'||['unauthorized','logout','pagehide'].includes(event.detail?.reason))dispose();},{signal:lifetime.signal});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
 const errorNode=()=>dialog.querySelector('[data-event-error]')||dialog.querySelector('.school-dialog-body');
 const showError=error=>{const node=errorNode();node.setAttribute('role','alert');node.textContent=error.message||String(error);};
 const controls=()=>{dialog.querySelectorAll('input,select').forEach(n=>n.disabled=busy||!validated||!model?.canEdit||(n.name==='calendarId'&&model.calendarTarget?.locked===true));dialog.querySelectorAll('button').forEach(n=>n.disabled=busy||((n.type==='submit'||n.hasAttribute('data-event-delete'))&&(!validated||!model?.canEdit)));};
 function paint(value){model=value;dialog.setAttribute('aria-label',model.editorTitle||'일정 수정');
 const field=(name,label,value,type='text')=>`<label class="field">${label}<input name="${name}" type="${type}" ${name==='time'?'data-literal-text':''} value="${esc(value)}" ${name==='title'?'maxlength="2000" required':name==='location'?'maxlength="2000"':name==='time'||name==='endTime'||name==='start'&&model.optionalStart?'':'required'} ${model.canEdit?'':'disabled'}></label>`;dialog.innerHTML=`<form><header class="school-dialog-header"><h2>${esc(model.editorTitle||'일정 수정')}</h2></header><div class="school-dialog-body"><p class="sub" data-event-source>${esc(model.source||'')}${model.timeZone?' · '+esc(model.timeZone):''}${model.allDay?' · 종일':''}</p><p data-calendar-target-error role="alert">${esc(model.calendarTarget?.metadataError||'')}</p>${model.calendarTarget?.metadataError?`<p role="status">${esc(model.calendarTarget.metadataError)}</p>`:''}${model.calendarTarget?`<label class="field">캘린더<select name="calendarId" ${model.canEdit?'':'disabled'} aria-label="저장할 캘린더" required><option value="" disabled ${!model.calendarTarget.calendars.some(c=>c.id===model.calendarTarget.defaultCalendarId&&c.canWrite&&model.calendarTarget.canWrite)&&model.calendarTarget.defaultCalendarId!=='none'?'selected':''}>캘린더를 선택하세요</option>${model.calendarTarget.calendars.map(c=>`<option value="${esc(c.id)}" ${c.id===model.calendarTarget.defaultCalendarId&&c.canWrite&&model.calendarTarget.canWrite?'selected':''} ${!c.canWrite||!model.calendarTarget.canWrite?'disabled':''}>${esc(c.name)}${c.canWrite?'':' · 읽기 전용'}</option>`).join('')}<option value="none" ${model.calendarTarget.defaultCalendarId==='none'?'selected':''}>연결 안 함</option></select></label>`:''}${field('title','일정 이름',model.title)}${model.locationSupported===false?'':field('location','장소',model.location||'')}${model.nativeTime!==undefined?field('time','시간',model.nativeTime):''}${model.nativeEndTime!==undefined?field('endTime','종료 시간',model.nativeEndTime):''}${model.allowAllDayToggle?`<label><input type="checkbox" name="allDay" ${model.allDay?'checked':''}> 종일</label>`:''}${field('start','시작',model.start,model.inputType||(model.allDay?'date':'datetime-local'))}${model.singleStart?'':field('end',model.allDay?'마지막 날짜':model.endTimeZone&&model.endTimeZone!==model.timeZone?'종료 ('+model.endTimeZone+')':'종료',model.end,model.inputType||(model.allDay?'date':'datetime-local'))}${model.recurring?`<label><input type="checkbox" name="confirmInstance" required ${model.canEdit?'':'disabled'}> 반복 전체가 아닌 이 일정만 수정</label>`:''}<p role="note" data-event-permission>${esc(model.reason||'')}</p><p data-event-error role="alert"></p></div><footer class="school-dialog-footer actions"><button class="btn primary" type="submit" ${model.canEdit?'':'disabled'}>저장</button>${remove?'<button class="btn danger" type="button" data-event-delete>삭제</button>':''}<button class="btn" type="button" data-event-close>취소</button></footer></form>`;
 dialog.querySelector('[data-event-close]').onclick=()=>close();
 const form=dialog.querySelector('form');form.addEventListener('input',()=>dirty=true);form.addEventListener('change',()=>dirty=true);
 dialog.querySelector('[name=allDay]')?.addEventListener('change',event=>{for(const name of ['start','end']){const input=form.elements[name],value=input.value;input.type=event.target.checked?'date':'datetime-local';input.value=event.target.checked?value.slice(0,10):value.slice(0,10)+(name==='start'?'T09:00':'T10:00');}});
 dialog.querySelector('[data-event-delete]')?.addEventListener('click',async()=>{if(busy||!validated||!model.canEdit||!confirm('이 일정을 삭제할까요? 연결된 원래 Google 일정에도 삭제가 반영됩니다.'))return;busy=true;controls();try{await remove(model);if(!live())return;busy=false;close(true);await onSaved?.();}catch(error){if(live()){busy=false;showError(error);controls();}}});
 form.onsubmit=async event=>{event.preventDefault();if(busy||!validated||!model.canEdit)return;const values=Object.fromEntries(new FormData(form));values.confirmInstance=values.confirmInstance==='on';busy=true;controls();try{await save(values,model);if(!live())return;busy=false;dirty=false;close(true);await onSaved?.();}catch(error){if(live()){busy=false;showError(error);controls();}}};
 controls();
 }
 function bindAutosave(){if(autosave||!model.canEdit||model.calendarTarget||model.recurring||!(model.nativeTime!==undefined||model.source==='홈 일정'))return;const form=dialog.querySelector('form');form.querySelector('[type=submit]')?.remove();autosave=bindEditAutosave(form,{quiet:true,onDiscard:()=>{dirty=false;const refresh=autosaved;close(true);if(!refresh)void onSaved?.();},save:async values=>{if(!live()||!validated)throw Error('일정의 권한과 원본을 다시 확인하세요.');values.confirmInstance=false;await save(values,model);if(live()){autosaved=true;dirty=false;}}});}
 const shape=m=>JSON.stringify([!!m.allDay,!!m.recurring,m.nativeTime!==undefined,m.nativeEndTime!==undefined,!!m.singleStart,!!m.calendarTarget,!!m.allowAllDayToggle,m.inputType||'']);
 async function revalidate(){if(loading)return;loading=true;try{
  const fresh=await load();if(!live())return;
  if(model){
   if(dirty||shape(model)!==shape(fresh)){validated=false;showError(Error('원본 일정이 변경되었습니다. 현재 입력을 보관한 뒤 일정을 다시 열어 확인하세요.'));controls();return;}
   // Keep the form, focus and scroll nodes intact during background refresh.
   model=fresh;const source=dialog.querySelector('[data-event-source]');if(source)source.textContent=(fresh.source||'')+(fresh.timeZone?' · '+fresh.timeZone:'')+(fresh.allDay?' · 종일':'');for(const name of ['title','location','time','endTime','start','end']){const input=dialog.querySelector(`[name="${name}"]`),key=name==='time'?'nativeTime':name==='endTime'?'nativeEndTime':name;if(input)input.value=fresh[key]||'';}
   const select=dialog.querySelector('[name=calendarId]'),target=fresh.calendarTarget;if(select&&target){select.innerHTML='<option value="" disabled>캘린더를 선택하세요</option>'+target.calendars.map(c=>`<option value="${esc(c.id)}" ${!c.canWrite||!target.canWrite?'disabled':''}>${esc(c.name)}${c.canWrite?'':' · 읽기 전용'}</option>`).join('')+'<option value="none">연결 안 함</option>';select.value=target.defaultCalendarId==='none'||target.canWrite&&target.calendars.some(c=>c.id===target.defaultCalendarId&&c.canWrite)?target.defaultCalendarId:'';}const targetError=dialog.querySelector('[data-calendar-target-error]');if(targetError)targetError.textContent=fresh.calendarTarget?.metadataError||'';
   const endInput=dialog.querySelector('[name=end]');if(endInput?.parentElement.firstChild?.nodeType===Node.TEXT_NODE)endInput.parentElement.firstChild.textContent=fresh.allDay?'마지막 날짜':fresh.endTimeZone&&fresh.endTimeZone!==fresh.timeZone?'종료 ('+fresh.endTimeZone+')':'종료';
   const allDay=dialog.querySelector('[name=allDay]');if(allDay)allDay.checked=!!fresh.allDay;
   const permission=dialog.querySelector('[data-event-permission]');if(permission)permission.textContent=fresh.canEdit?'':fresh.reason||'';
   errorNode().textContent='';
  }else paint(fresh);
  validated=true;controls();bindAutosave();if(!initial)dialog.querySelector('input:not([disabled]),[data-event-close]')?.focus();
 }catch(error){if(!live())return;validated=false;
  if([401,403,404,409,410].includes(error.status)){dialog.querySelector('.school-dialog-body').replaceChildren();model=null;}
  showError(error);const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='다시 확인';retry.onclick=()=>{retry.remove();void revalidate();};errorNode().after(retry);controls();
 }finally{loading=false;}}
 dialog.querySelector('[data-event-close]').onclick=()=>close();dialog.showModal();
 if(initial){paint({...initial,canEdit:false,reason:''});dialog.querySelector('[data-event-close]').focus({preventScroll:true});}
 await revalidate();
}
