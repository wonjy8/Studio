import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export function connectionsPanel(admin=false){return `<section class="settings-page connections-panel"><div class="settings-section"><h3>외부 앱 연결</h3><div class="settings-row"><div><strong>ChatGPT에서 Studio 사용</strong><p>ChatGPT에서 프로젝트를 조회하고, 승인한 변경을 Studio에 저장합니다. 앱 내부 AI나 별도 OpenAI API 키는 사용하지 않습니다.</p></div></div><label class="field">연결 주소<input id="mcp-endpoint" readonly value="${esc(location.origin+'/mcp')}"></label><details class="connection-guide"><summary>ChatGPT 연결 방법</summary><ol><li>ChatGPT 설정의 앱에서 개발자 모드 또는 사용자 지정 앱 연결을 엽니다. 제공 여부는 계정·워크스페이스 정책에 따라 다릅니다.</li><li>위 주소를 MCP 서버 주소로 추가하고 OAuth 인증을 선택합니다.</li><li>Studio 계정에 로그인한 뒤 읽기 또는 읽기·수정 권한을 승인합니다.</li><li>ChatGPT 대화에 Studio 앱을 연결하고 “프로젝트 목록을 보여줘”라고 요청합니다. 수정은 변경 내용을 확인한 뒤 승인하세요.</li></ol><p class="sub">파일 원본 대신 프로젝트·촬영·일정·인원·장비·배치·레퍼런스 정보를 제공합니다. 별도 Cloudflare Access 로그인이 서버 요청을 막으면 해당 MCP·OAuth 경로의 접근 정책을 조정해야 합니다. Studio OAuth 인증은 계속 필요합니다.</p></details><p id="connection-error" class="login-error" role="alert"></p><div id="connection-list" aria-live="polite"></div>${admin?`<details class="connection-guide"><summary>연결 문제 진단 · 관리자</summary><p class="sub">연결 생성을 다시 시도한 뒤 아래 버튼을 누르세요. 최근 요청의 도착 여부와 실패 단계만 표시합니다.</p><button class="btn" id="connection-diagnose">진단 새로고침</button><textarea id="connection-diagnostic-output" class="diagnostic-output" readonly rows="8" aria-label="연결 진단 결과" placeholder="진단 결과가 여기에 표시됩니다"></textarea><button class="btn" id="connection-copy-diagnostic" hidden>진단 복사</button></details>`:''}</div></section>`;}
export function bindConnections(){
 const root=document.querySelector('.connections-panel');if(!root)return;
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
  root.querySelector('#connection-list').innerHTML=data.connections.map(c=>`<div class="settings-row"><div><strong>외부 ChatGPT 연결 · ${c.scope.includes('studio:write')?'읽기·수정':'읽기 전용'}</strong><p>${esc(new Date(c.created_at).toLocaleString('ko-KR'))} 연결 · ${esc(new Date(c.refresh_expires).toLocaleString('ko-KR'))} 만료</p></div><button class="btn danger" data-disconnect="${c.id}">연결 해제</button></div>`).join('')||'<p class="sub">연결된 외부 앱이 없습니다.</p>';
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
  root.innerHTML=`<main class="login-page"><section class="login-panel"><h1>Studio 외부 연결 승인</h1><p>현재 로그인한 계정의 프로젝트·촬영·일정·인원·장비·배치·레퍼런스 정보를 ChatGPT에 제공합니다.</p><p class="sub">연결 대상: ${esc(new URL(pending.redirect_uri).hostname)}. 모든 프로젝트에 적용되며, 비밀번호·세션·파일 원본은 제공하지 않습니다. 설정에서 언제든 연결을 해제할 수 있습니다.</p><form class="form" id="connection-consent">${write?'<label class="consent-write"><input name="write" type="checkbox"> 항목 추가·수정도 허용합니다. 변경 적용은 대화에서 따로 확인합니다.</label>':'<p class="status">읽기 전용 연결</p>'}<p class="login-error" id="consent-error" role="alert"></p><button class="btn primary" type="submit">연결 승인</button><button class="btn" type="button" id="consent-deny">취소</button></form></section></main>`;
  const finish=async approve=>{
   root.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{const data=await request('connections/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,approve,allowWrite:approve&&Boolean(root.querySelector('[name=write]')?.checked)})});location.assign(data.redirect);}catch{root.querySelector('#consent-error').textContent='연결을 승인하지 못했습니다. ChatGPT에서 다시 연결해 주세요.';root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  root.querySelector('form').onsubmit=e=>{e.preventDefault();finish(true);};root.querySelector('#consent-deny').onclick=()=>finish(false);
 }catch{root.innerHTML='<main class="login-page"><section class="login-panel"><h1>연결 요청을 확인할 수 없습니다.</h1><p>요청이 만료되었거나 사용할 수 없습니다. ChatGPT에서 다시 연결해 주세요.</p><a class="btn" href="/">Studio로 돌아가기</a></section></main>';}
 return true;
}
