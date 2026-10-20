import {manualClientPanel,bindManualOAuth} from './manual-oauth.js';
import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export function connectionsPanel(admin=false,username=''){return `<section class="settings-section property-settings connections-panel"><h3>ChatGPT</h3><p class="sub">${username?'Studio 계정 · @'+esc(username):'현재 Studio 계정'}</p><details class="connection-guide"><summary>ChatGPT 연결 방법</summary><label class="field property-field">연결 주소<input id="mcp-endpoint" readonly value="${esc(location.origin+'/mcp')}"></label><ol><li>ChatGPT 설정에서 사용자 지정 앱을 추가합니다.</li><li>위 주소를 MCP 서버 주소로 추가하고 OAuth 인증을 선택합니다.</li><li>Studio 계정에 로그인한 뒤 읽기 또는 읽기·수정 권한을 승인합니다.</li><li>대화에서 Studio를 선택합니다. 수정은 확인 후 승인하세요.</li></ol><p class="sub">프로젝트·문서·멤버/조직 장비·자료·말씀·QT·감사·기도제목을 계정의 기존 접근 권한 안에서 제공합니다. 계정·설정·관리자·권한 변경과 파일 원본은 제외합니다. 별도 Cloudflare Access 로그인이 서버 요청을 막으면 해당 MCP·OAuth 경로의 접근 정책을 조정해야 합니다. Studio OAuth 인증은 계속 필요합니다.</p></details><p id="connection-error" class="login-error" role="alert"></p><div id="connection-list" aria-live="polite"></div>${admin?`<details class="connection-guide"><summary>관리자 설정</summary>${manualClientPanel()}<details class="connection-guide"><summary>연결 문제 진단 · 관리자</summary><p class="sub">연결 생성을 다시 시도한 뒤 아래 버튼을 누르세요. 최근 요청의 도착 여부와 실패 단계만 표시합니다.</p><button class="btn" id="connection-diagnose">진단 새로고침</button><textarea id="connection-diagnostic-output" class="diagnostic-output" readonly rows="8" aria-label="연결 진단 결과" placeholder="진단 결과가 여기에 표시됩니다"></textarea><button class="btn" id="connection-copy-diagnostic" hidden>진단 복사</button></details></details>`:''}</section>`;}
export function bindConnections(){
 const root=document.querySelector('.connections-panel');if(!root)return;
 bindManualOAuth(root);
 const error=root.querySelector('#connection-error');
 const diagnose=root.querySelector('#connection-diagnose');if(diagnose)diagnose.onclick=async e=>{
  const button=e.currentTarget,output=root.querySelector('#connection-diagnostic-output');button.disabled=true;
  try{const data=await request('connections/diagnostics');output.value=JSON.stringify(data,null,2);root.querySelector('#connection-copy-diagnostic').hidden=false;}
  catch{output.value='관리자 계정으로 로그인했는지 확인해 주세요. 진단 기능이 아직 적용되지 않았다면 잠시 후 새로고침해 주세요.';}
  finally{button.disabled=false;}
 };
 const copy=root.querySelector('#connection-copy-diagnostic');if(copy)copy.onclick=async()=>{const output=root.querySelector('#connection-diagnostic-output');try{await navigator.clipboard.writeText(output.value);}catch{output.select();}};

 const refresh=async()=>{
  const data=await request('connections');if(!root.isConnected)return;
  root.querySelector('#connection-list').innerHTML=data.connections.map(c=>`<div class="property-row"><span class="property-label">연결됨</span><div class="property-value"><span class="connection-permission">${c.scope.includes('studio:write')?'읽기·수정':'읽기 전용'} · ${c.contentConsentVersion===1?'전체 콘텐츠':'프로젝트만'}<small>${esc(new Date(c.created_at).toLocaleDateString('ko-KR'))} 연결 · ${esc(new Date(c.refresh_expires).toLocaleDateString('ko-KR'))} 만료</small></span>${c.contentConsentVersion===1?'':`<details><summary>전체 콘텐츠 연결</summary><p>문서·장비·자료와 개인 말씀·QT·감사·기도제목·구절 메모도 요청할 때 ChatGPT에 전달됩니다. 이 연결의 기존 읽기/수정 권한을 유지하며 계정·설정·관리자는 제외합니다.</p><button class="btn" data-content-consent="${c.id}">이 연결에 전체 콘텐츠 허용</button></details>`}<button class="btn danger" data-disconnect="${c.id}">연결 해제</button></div></div>`).join('')||'<p class="sub">연결 안 됨 · 연결 방법에서 ChatGPT 앱을 추가하세요.</p>';
  root.querySelectorAll('[data-content-consent]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await request('connections/'+b.dataset.contentConsent+'/content-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approve:true,version:1})});await refresh();}catch{error.textContent='콘텐츠 연결 승인을 저장하지 못했습니다.';b.disabled=false;}});
  root.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await request('connections/'+b.dataset.disconnect,{method:'DELETE'});await refresh();}catch{error.textContent='연결을 해제하지 못했습니다.';b.disabled=false;}});
 };
 refresh().catch(()=>{error.textContent='연결 목록을 불러오지 못했습니다.';});
}
export async function connectionConsent(){
 const id=new URL(location.href).searchParams.get('connect');if(!id)return false;
 const root=document.querySelector('#app');
 try{
  if(!/^[a-f0-9]{64}$/.test(id))throw Error('잘못된 연결 요청입니다.');
  const pending=await request('connections/requests/'+id),write=pending.scope.split(' ').includes('studio:write');
  root.innerHTML=`<main class="login-page"><section class="login-panel"><h1>Studio 외부 연결 승인</h1><p>현재 로그인한 계정에서 접근 가능한 프로젝트·촬영·할 일·문서·멤버/조직 장비·자료와 개인 말씀·QT·감사·기도제목·구절 메모를 요청할 때 ChatGPT에 제공합니다.</p><p class="sub">연결 대상: ${esc(new URL(pending.redirect_uri).hostname)}. 전체 콘텐츠에 지속 적용되며, 다른 계정의 비공개 기록·계정·설정·관리자·권한 변경과 비밀번호·세션·파일 원본은 제공하지 않습니다. 설정에서 언제든 연결을 해제할 수 있습니다.</p><form class="form" id="connection-consent">${write?'<label class="consent-write"><input name="write" type="checkbox"> 항목 추가·수정도 허용합니다. 변경 적용은 대화에서 따로 확인합니다.</label>':'<p class="status">읽기 전용 연결</p>'}<p class="login-error" id="consent-error" role="alert"></p><button class="btn primary" type="submit">연결 승인</button><button class="btn" type="button" id="consent-deny">취소</button></form></section></main>`;
  const finish=async approve=>{
   root.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{const data=await request('connections/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,approve,allowFullContent:approve,allowWrite:approve&&Boolean(root.querySelector('[name=write]')?.checked)})});location.assign(data.redirect);}catch{root.querySelector('#consent-error').textContent='연결을 승인하지 못했습니다. ChatGPT에서 다시 연결해 주세요.';root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  root.querySelector('form').onsubmit=e=>{e.preventDefault();finish(true);};root.querySelector('#consent-deny').onclick=()=>finish(false);
 }catch{root.innerHTML='<main class="login-page"><section class="login-panel"><h1>연결 요청을 확인할 수 없습니다.</h1><p>요청이 만료되었거나 사용할 수 없습니다. ChatGPT에서 다시 연결해 주세요.</p><a class="btn" href="/">Studio로 돌아가기</a></section></main>';}
 return true;
}
