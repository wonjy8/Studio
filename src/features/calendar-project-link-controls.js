import {escapeHtml as esc} from '../design-system/primitives/html.js';
// Explicit private-membership changes; these controls never enter event FormData.
export function bindCalendarProjectLinkControls(dialog,{getModel,projects,isReady,onApply,onSelectionChange=()=>{}}){
 const host=dialog.querySelector('[data-event-project-links]');if(!host)return null;
 let baseline='[]',applying=false;
 const selected=()=>[...host.querySelectorAll('[data-event-project-id]:checked')].map(n=>n.value).sort();
 const pending=()=>JSON.stringify(selected())!==baseline;
 function update(){const model=getModel(),link=model?.projectLink,ids=link?.projectIds;
  if(!Array.isArray(ids)){host.innerHTML='<div aria-busy="true"></div>';return;}
  const known=projects.filter(p=>p&&typeof p.id==='string'),selectedIds=new Set(ids);baseline=JSON.stringify(ids.filter(id=>known.some(p=>p.id===id)).sort());
  host.innerHTML=`<p class="sub">내 화면의 프로젝트 일정에만 연결합니다. 공유 권한과 Google 원본은 바뀌지 않습니다. 일정 내용 수정과 연결 적용은 한 번에 하나씩 진행합니다.</p><div class="calendar-project-link-choices">${known.map(p=>`<label><input type="checkbox" value="${esc(p.id)}" data-event-project-id ${selectedIds.has(p.id)?'checked':''} ${!isReady()||!link.canLink?'disabled':''}>${esc(p.name)}</label>`).join('')}</div>${link.reason?`<p role="note">${esc(link.reason)}</p>`:''}<p role="alert" data-project-link-error></p><button class="btn" type="button" data-event-project-apply ${!isReady()||!link.canLink?'disabled':''}>연결 적용</button>`;
  host.querySelectorAll('[data-event-project-id]').forEach(n=>n.onchange=onSelectionChange);
  host.querySelector('[data-event-project-apply]').onclick=async()=>{if(applying||!isReady()||!link.canLink||!pending())return;applying=true;try{await onApply(selected());}catch(error){if(host.isConnected)host.querySelector('[data-project-link-error]').textContent=error.message;}finally{applying=false;}};
 }
 update();return {update,pending};
}
