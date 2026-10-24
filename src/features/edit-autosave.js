// Ordinary existing-record edits only. Creation and consequential actions stay explicit.
const drafts=new Set();
export function createEditAutosave({read,save,onState=()=>{},delay=600}){
 let version=0,dirty=false,job=null,timer,error='',paused=false,baseline=JSON.stringify(read());
 const emit=()=>onState({dirty,saving:Boolean(job),error});
 async function flush(){clearTimeout(timer);if(paused)throw Error('입력을 확정한 뒤 이동하세요.');if(job){await job;if(dirty)return flush();return;}if(!dirty)return;
  const work=Promise.resolve().then(async()=>{try{error='';while(dirty&&!paused){const snapshot=structuredClone(read()),current=version;await save(snapshot);baseline=JSON.stringify(snapshot);if(version===current)dirty=false;}}catch(e){error=e.message||'저장하지 못했습니다.';}finally{job=null;emit();}});job=work;emit();await work;if(dirty)throw Error(error||'입력 내용을 확인하세요.');
 }
 function change(){if(paused)return;if(!dirty&&JSON.stringify(read())===baseline)return;dirty=true;version++;error='';clearTimeout(timer);timer=setTimeout(()=>void flush().catch(()=>{}),delay);emit();}
 return {change,flush,pending:()=>dirty||Boolean(job)||paused,pause(){paused=true;clearTimeout(timer);},resume(){paused=false;change();},state:()=>({dirty,saving:Boolean(job),error}),dispose(){clearTimeout(timer);}};
}
export function bindEditAutosave(form,{save,read=()=>Object.fromEntries(new FormData(form)),delay=600}){
 form.querySelectorAll('button[type=button]').forEach(b=>{if(b.textContent.trim()==='취소')b.textContent='닫기';});const host=document.createElement('div');host.className='edit-save-state';host.innerHTML='<span class="sub" role="status" data-edit-save-status></span> <button class="btn" type="button" data-edit-save-retry hidden>다시 저장</button>';form.append(host);const status=host.querySelector('[data-edit-save-status]'),retry=host.querySelector('button');
 const draft=createEditAutosave({read,delay,save:async snapshot=>{if(!form.checkValidity())throw Error('입력 내용을 확인하세요. 변경 내용은 유지됩니다.');await save(snapshot);},onState:({dirty,saving,error})=>{status.textContent=error||(saving?'저장 중…':dirty?'저장 대기':'저장됨');status.setAttribute('role',error?'alert':'status');retry.hidden=!error;const indicator=document.querySelector('.save-indicator');if(form.isConnected&&indicator){indicator.textContent=status.textContent;indicator.classList.toggle('has-error',Boolean(error));}}});
 draft.form=form;drafts.add(draft);form.addEventListener('compositionstart',draft.pause);form.addEventListener('compositionend',draft.resume);form.addEventListener('input',event=>{if(!event.isComposing)draft.change();});form.addEventListener('change',draft.change);retry.onclick=()=>void draft.flush().catch(()=>{});form.onsubmit=e=>{e.preventDefault();draft.change();void draft.flush().catch(()=>{});};status.textContent='저장됨';return draft;
}
function pending(){for(const d of drafts)if(!d.form.isConnected&&!d.pending()){d.dispose();drafts.delete(d);}return [...drafts].filter(d=>d.pending());}
export async function flushEditAutosaves(){for(const d of pending())await d.flush();}
if(typeof document!=='undefined'){
 let replay=false;
 document.addEventListener('click',event=>{if(replay||!pending().length)return;const target=event.target.matches('[data-close]')?event.target:event.target.closest('button,a[href],input[type=checkbox],input[type=radio]');if(!target||target.closest('[data-edit-save-retry]')||target.closest('[popover],.project-icon-picker'))return;if([...drafts].some(d=>d.form.contains(target))&&target.matches('input[type=checkbox],input[type=radio]'))return;event.preventDefault();event.stopImmediatePropagation();void flushEditAutosaves().then(()=>{if(target.isConnected){replay=true;try{target.click();}finally{replay=false;}}}).catch(()=>{});},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&event.keyCode!==229&&pending().length){event.preventDefault();event.stopImmediatePropagation();void flushEditAutosaves().catch(()=>{});}},true);
 window.addEventListener('beforeunload',event=>{if(pending().length){event.preventDefault();event.returnValue='';}});

}
