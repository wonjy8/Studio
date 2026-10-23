import {request,getRequestAccount} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
// Selection does not mutate files. The caller persists the chosen existing IDs.
export async function pickReferenceAttachments({alive,accept=()=>true,trigger}){
 const dialog=document.createElement('dialog');dialog.className='project-member-picker';dialog.setAttribute('aria-label','모든 자료에서 추가');
 dialog.innerHTML='<header class="member-picker-header"><h2>모든 자료에서 추가</h2><button type="button" class="btn" data-close>닫기</button></header><label class="field">검색<input type="search" aria-label="자료 검색"></label><div class="member-picker-list"></div><p role="status"></p><footer class="member-picker-footer"><button type="button" class="btn primary" data-add disabled>추가</button></footer>';
 document.body.append(dialog);dialog.showModal();
 const account=getRequestAccount();
 let items=[];const chosen=new Set(),status=dialog.querySelector('[role=status]');
 const result=new Promise(resolve=>{dialog.addEventListener('close',()=>{resolve(dialog.returnValue==='add'?items.filter(item=>chosen.has(item.id)):[]);dialog.remove();if(trigger?.isConnected)trigger.focus();},{once:true});});
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-add]').onclick=()=>dialog.close('add');
 function draw(){const query=dialog.querySelector('input[type=search]').value.toLocaleLowerCase();dialog.querySelector('.member-picker-list').innerHTML=items.filter(item=>(item.title+' '+item.fileName).toLocaleLowerCase().includes(query)).map(item=>`<label class="member-picker-row"><input type="checkbox" value="${esc(item.id)}" ${chosen.has(item.id)?'checked':''}><span>${esc(item.title||item.fileName||'첨부 파일')}</span></label>`).join('')||'<p class="sub">추가할 수 있는 업로드 자료가 없습니다.</p>';dialog.querySelectorAll('input[type=checkbox]').forEach(box=>box.onchange=()=>{if(box.checked)chosen.add(box.value);else chosen.delete(box.value);dialog.querySelector('[data-add]').disabled=!chosen.size;});}
 dialog.querySelector('input[type=search]').oninput=draw;
 const lifetime=new MutationObserver(()=>{if(!alive()){dialog.close();lifetime.disconnect();}});lifetime.observe(document.body,{childList:true,subtree:true});result.finally(()=>lifetime.disconnect());
 async function load(){status.replaceChildren();try{const before=await request('session');if(!account||before.account?.id!==account)throw Error('로그인 계정이 변경되었습니다. 화면을 새로고침하세요.');const data=await request('materials'),after=await request('session');if(!dialog.isConnected||!alive())return;if(after.account?.id!==account)throw Error('로그인 계정이 변경되었습니다. 화면을 새로고침하세요.');items=(data.items||[]).filter(item=>item.fileId&&accept(item));draw();}catch(error){if(!dialog.isConnected||!alive())return;status.textContent='자료를 불러오지 못했습니다. '+error.message;const retry=document.createElement('button');retry.className='btn';retry.textContent='다시 불러오기';retry.onclick=load;status.append(retry);}}
 await load();return result;
}
