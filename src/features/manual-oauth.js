import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export function manualClientPanel(){return `<details class="connection-guide manual-oauth"><summary>수동 OAuth 연결 · 관리자</summary><p>자동 등록(DCR)에서 연결이 진행되지 않을 때 사용합니다. 생성한 ID와 비밀키는 외부 앱의 OAuth 고급 설정에서 <strong>직접 클라이언트 자격 증명 입력</strong> 방식에 입력하세요.</p><form class="form" id="manual-oauth-form"><label class="field">허용할 콜백 주소<textarea name="callbacks" rows="3" required>https://chatgpt.com/connector_platform_oauth_redirect
https://chat.openai.com/connector_platform_oauth_redirect</textarea></label><p class="sub">ChatGPT가 별도 콜백 주소를 표시하면 그 주소로 바꿔 주세요. 한 줄에 하나씩, 최대 5개까지 등록합니다. 주소는 정확히 일치해야 합니다.</p><button class="btn" type="submit">수동 클라이언트 만들기</button></form><p class="login-error" id="manual-oauth-error" role="alert"></p><div id="manual-oauth-result" aria-live="polite"></div><div id="manual-oauth-list"></div></details>`;}
export function bindManualOAuth(root){
 const form=root.querySelector('#manual-oauth-form');if(!form)return;
 const error=root.querySelector('#manual-oauth-error'),result=root.querySelector('#manual-oauth-result');
 const refresh=async()=>{
  const {clients}=await request('connections/clients');if(!root.isConnected)return;
  root.querySelector('#manual-oauth-list').innerHTML=clients.map(c=>`<div class="settings-row"><div><strong>수동 클라이언트</strong><p>${esc(new Date(c.createdAt).toLocaleString('ko-KR'))} 생성 · ${esc(c.id.slice(0,8))}…</p></div><button class="btn danger" data-remove-client="${c.id}">클라이언트 폐기</button></div>`).join('');
  root.querySelectorAll('[data-remove-client]').forEach(b=>b.onclick=async()=>{
   if(!confirm('이 클라이언트를 폐기하고 관련 계정의 연결을 모두 해제할까요?'))return;
   b.disabled=true;try{await request('connections/clients/'+b.dataset.removeClient,{method:'DELETE'});result.replaceChildren();await refresh();}catch{error.textContent='클라이언트를 폐기하지 못했습니다.';b.disabled=false;}
  });
 };
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;error.textContent='';result.replaceChildren();
  try{
   const redirectUris=form.elements.callbacks.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const data=await request('connections/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({redirectUris})});if(!root.isConnected)return;
   result.innerHTML=`<div class="invite-link-box"><p class="sub">비밀키는 지금 한 번만 표시됩니다. 외부 앱의 설정에만 입력하고 채팅이나 스크린샷으로 공유하지 마세요. 이 키만으로 프로젝트에 접근할 수 없으며, Studio 로그인·권한 승인이 추가로 필요합니다.</p><label class="field">클라이언트 ID<input id="manual-client-id" readonly value="${esc(data.clientId)}"></label><button class="btn" type="button" data-copy-client="manual-client-id">ID 복사</button><label class="field">클라이언트 비밀키<input id="manual-client-secret" type="password" readonly autocomplete="off" value="${esc(data.clientSecret)}"></label><button class="btn" type="button" data-copy-client="manual-client-secret">비밀키 복사</button><button class="btn" type="button" id="hide-manual-client">화면에서 지우기</button></div>`;
   result.querySelectorAll('[data-copy-client]').forEach(b=>b.onclick=async()=>{const input=result.querySelector('#'+b.dataset.copyClient);try{await navigator.clipboard.writeText(input.value);b.textContent='복사됨';}catch{input.focus();input.select();error.textContent='선택된 내용을 직접 복사해 주세요.';}});
   result.querySelector('#hide-manual-client').onclick=()=>result.replaceChildren();await refresh();
  }catch(e){error.textContent=e.message==='invalid_redirect_uri'?'HTTPS의 정확한 ChatGPT 콜백 주소인지 확인해 주세요.':e.message==='manual_client_limit'?'사용 가능한 수동 클라이언트는 최대 10개입니다.':'클라이언트를 생성하지 못했습니다. 콜백 주소와 관리자 권한을 확인해 주세요.';}
  finally{button.disabled=false;}
 };
 refresh().catch(()=>{error.textContent='수동 클라이언트 목록을 불러오지 못했습니다.';});
}
