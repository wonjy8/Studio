import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export function invitationPanel(){return `<section class="settings-page invitation-panel"><div class="settings-section"><h3>관리자 · 회원 초대</h3><div class="settings-row"><div><strong>초대 링크</strong><p>48시간 동안 한 명만 가입할 수 있습니다.</p></div><button class="btn primary" id="create-invite">초대 링크 만들기</button></div><div id="invite-output" aria-live="polite"></div><p class="login-error" role="alert" id="invite-error"></p><div id="invite-list"></div></div></section>`;}
export function bindInvitations(){
 const root=document.querySelector('.invitation-panel');if(!root)return;
 const error=root.querySelector('#invite-error');
 const refresh=async()=>{
  const {invitations}=await request('invitations');if(!root.isConnected)return;
  root.querySelector('#invite-list').innerHTML=invitations.map(inv=>{const state=inv.used_at?'가입 완료':inv.revoked_at?'취소됨':inv.expires<=Date.now()?'만료됨':'사용 가능';return `<div class="settings-row invite-row"><div><strong>${state}</strong><p>${esc(new Date(inv.created_at).toLocaleString('ko-KR'))} 생성 · ${esc(new Date(inv.expires).toLocaleString('ko-KR'))} 만료</p></div>${state==='사용 가능'?`<button class="btn" data-revoke="${esc(inv.id)}">초대 취소</button>`:''}</div>`;}).join('')||'<p class="sub">아직 만든 초대가 없습니다.</p>';
  root.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await request(`invitations/${b.dataset.revoke}`,{method:'DELETE'});await refresh();}catch{error.textContent='초대를 취소하지 못했습니다.';b.disabled=false;}});
 };
 root.querySelector('#create-invite').onclick=async e=>{
  const button=e.currentTarget;button.disabled=true;error.textContent='';
  try{const invite=await request('invitations',{method:'POST'});if(!root.isConnected)return;
   root.querySelector('#invite-output').innerHTML=`<div class="invite-link-box"><label for="invite-url">이 링크는 다시 표시되지 않습니다. 복사해 초대할 사람에게 전달하세요.</label><input id="invite-url" readonly value="${esc(invite.url)}"><button class="btn" id="copy-invite">링크 복사</button></div>`;
   root.querySelector('#copy-invite').onclick=async e=>{try{await navigator.clipboard.writeText(invite.url);e.target.textContent='복사됨';}catch{root.querySelector('#invite-url').select();error.textContent='선택한 링크를 직접 복사해 주세요.';}};
   await refresh();
  }catch(e){error.textContent=e.message==='INVITE_LIMIT'?'사용 가능한 초대는 최대 20개입니다. 기존 초대를 취소해 주세요.':'초대 링크를 만들지 못했습니다.';}
  finally{button.disabled=false;}
 };
 refresh().catch(()=>{error.textContent='초대 목록을 불러오지 못했습니다.';});
}
