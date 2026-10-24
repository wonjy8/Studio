import {escapeHtml as esc} from '../design-system/primitives/html.js';
// Moving the Google original is an explicit consequential action, never FormData/autosave.
export function bindCalendarEventMoveControls(dialog,{getModel,isReady,onChange,onMove,onVerify,onComplete}){
 const host=dialog.querySelector('[data-event-move]');if(!host)return null;
 let receipt=null,working=false,requestId=null;
 const pending=()=>!!host.querySelector('[data-event-move-destination]')?.value;
 const blocked=()=>working||['pending','uncertain'].includes(receipt?.status);
 function controls(){const model=getModel(),locked=blocked();host.querySelectorAll('select').forEach(n=>n.disabled=working||locked||!isReady()||!model?.move?.canMove);const button=host.querySelector('[data-event-move-apply]');if(button)button.disabled=working||locked||!isReady()||!model?.move?.canMove;const verify=host.querySelector('[data-event-move-verify]');if(verify)verify.disabled=working;}
 function render(){const move=getModel()?.move;receipt=move?.pending||receipt;host.innerHTML=`<p class="sub">Google 원본의 캘린더와 주최자가 바뀝니다. 프로젝트 연결은 유지됩니다. 같은 연결 계정의 단일 일반 일정만 지원합니다.</p>${move?.canMove?`<label class="field">이동할 캘린더<select data-event-move-destination aria-label="이동할 캘린더"><option value="">선택하세요</option>${move.calendars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><button class="btn" type="button" data-event-move-apply>원본 이동</button>`:`<p role="note">${esc(move?.reason||'원본 권한을 확인한 뒤 이동할 수 있습니다.')}</p>`}<p role="alert" data-event-move-error></p><button class="btn" type="button" data-event-move-verify hidden>이동 결과 확인</button>`;
  host.querySelector('select')?.addEventListener('change',()=>{requestId=null;onChange();});
  host.querySelector('[data-event-move-apply]')?.addEventListener('click',async()=>{if(working||blocked()||!isReady()||!pending())return;const destination=host.querySelector('select').value,name=getModel().move.calendars.find(c=>c.id===destination)?.name;if(!confirm(`${name} 캘린더로 원본 일정을 이동할까요? 주최자가 바뀌며 Google 원본 위치도 변경됩니다. 프로젝트 연결은 유지됩니다.`))return;requestId ||= crypto.randomUUID();working=true;onChange();controls();try{await accept(await onMove(destination,requestId,getModel()));}catch(error){receipt={requestId,status:error.status&&error.status<500?'rejected':'uncertain',message:error.status&&error.status<500?error.message:'이동 결과가 확실하지 않습니다. 다시 이동하지 말고 결과를 확인하세요. '+error.message};show();}finally{working=false;controls();onChange();}});
  host.querySelector('[data-event-move-verify]').onclick=async()=>{if(working||!receipt)return;working=true;controls();try{await accept(await onVerify(receipt.requestId));}catch(error){host.querySelector('[data-event-move-error]').textContent=error.message;}finally{working=false;controls();onChange();}};show();controls();
 }
 function show(){const error=host.querySelector('[data-event-move-error]'),verify=host.querySelector('[data-event-move-verify]');if(error)error.textContent=receipt?.message||'';if(verify)verify.hidden=!['pending','uncertain'].includes(receipt?.status);}
 async function accept(response){receipt=response.move;if(receipt.status==='complete'){await onComplete(receipt);return;}if(receipt.status==='rejected'){requestId=null;getModel().move.pending=null;}show();}
 render();return {pending,blocked,controls,update:render};
}
