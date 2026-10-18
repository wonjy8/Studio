import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export function invitationPanel(){return `<section class="settings-section property-settings invitation-panel"><h2>회원 초대</h2><form class="form property-fields invitation-properties" data-invitation-form><label class="field"><span>유효시간</span><select id="invite-hours"><option value="12">12시간</option><option value="24">24시간</option><option value="48" selected>48시간</option></select></label><label class="field"><span>인원 제한</span><select id="invite-limit"><option value="limited">인원 지정</option><option value="unlimited">무제한</option></select></label><label class="field" id="invite-count-field"><span>최대 인원</span><input id="invite-count" type="number" min="1" step="1" value="1" required></label><button class="btn primary" id="create-invite" type="submit">초대 링크 만들기</button></form><div id="invite-output" aria-live="polite"></div><p class="login-error" role="alert" id="invite-error"></p><div id="invite-list" aria-label="초대 목록"></div></section>`;}

export function bindInvitations(){
 const root=document.querySelector('.invitation-panel');if(!root)return;
 const error=root.querySelector('#invite-error');
 const refresh=async()=>{
  const {invitations}=await request('invitations');if(!root.isConnected)return;
  root.querySelector('#invite-list').innerHTML=invitations.map(inv=>{const state=inv.revoked_at?'취소됨':inv.expires<=Date.now()?'만료됨':inv.max_uses!==null&&inv.use_count>=inv.max_uses?'인원 마감':'사용 가능';return `<article class="invite-row"><div><strong>${state}</strong><div class="sub">${inv.use_count}명 가입 · ${inv.max_uses===null?'무제한':inv.max_uses+'명 제한'}</div></div><div class="invite-expiry"><span class="sub">만료</span><time datetime="${new Date(inv.expires).toISOString()}">${esc(new Date(inv.expires).toLocaleString('ko-KR'))}</time></div>${state==='사용 가능'?`<button class="btn" data-revoke="${esc(inv.id)}">초대 취소</button>`:''}</article>`;}).join('')||'<p class="sub">아직 만든 초대가 없습니다.</p>';
  root.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await request(`invitations/${b.dataset.revoke}`,{method:'DELETE'});await refresh();}catch{error.textContent='초대를 취소하지 못했습니다.';b.disabled=false;}});
 };
 root.querySelector('#invite-limit').onchange=e=>{const unlimited=e.target.value==='unlimited';root.querySelector('#invite-count-field').hidden=unlimited;root.querySelector('#invite-count').disabled=unlimited;};
 root.querySelector('[data-invitation-form]').onsubmit=async e=>{
  e.preventDefault();if(root.querySelector('#create-invite').disabled)return;
  const count=root.querySelector('#invite-count');if(root.querySelector('#invite-limit').value==='limited'&&!count.reportValidity())return;
  const button=root.querySelector('#create-invite');button.disabled=true;error.textContent='';
  try{const invite=await request('invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hours:Number(root.querySelector('#invite-hours').value),maxUses:root.querySelector('#invite-limit').value==='unlimited'?null:Number(count.value)})});if(!root.isConnected)return;
   root.querySelector('#invite-output').innerHTML=`<div class="invite-link-box"><label for="invite-url">초대 링크</label><div class="invite-link-controls"><input id="invite-url" readonly value="${esc(invite.url)}"><button class="btn" id="copy-invite" type="button">링크 복사</button></div></div>`;
   root.querySelector('#copy-invite').onclick=async e=>{try{await navigator.clipboard.writeText(invite.url);e.target.textContent='복사됨';}catch{root.querySelector('#invite-url').select();error.textContent='선택한 링크를 직접 복사해 주세요.';}};
   await refresh();
  }catch(e){error.textContent=e.message==='INVITE_LIMIT'?'사용 가능한 초대는 최대 20개입니다. 기존 초대를 취소해 주세요.':'초대 링크를 만들지 못했습니다.';}
  finally{button.disabled=false;}
 };
 refresh().catch(()=>{error.textContent='초대 목록을 불러오지 못했습니다.';});
}
