import {request} from '../integrations/api.js';
export async function requireLogin() {
  try {await request('session');return;}catch{}
  await new Promise(resolve=>{
    const root=document.querySelector('#app');
    root.innerHTML=`<main class="main"><section class="card" style="max-width:420px;margin:10vh auto"><h1>Studio</h1><p>프로젝트에 로그인하세요.</p><form class="form" id="login"><label>사용자 이름<input name="username" autocomplete="username" required maxlength="64"></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><p role="alert" id="login-error"></p><button class="btn primary">로그인</button></form></section></main>`;
    root.querySelector('form').onsubmit=async e=>{
      e.preventDefault();const form=e.target;const button=form.querySelector('button');button.disabled=true;
      try {await request('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();resolve();}
      catch {root.querySelector('#login-error').textContent='로그인하지 못했습니다. 계정 정보를 확인하거나 잠시 후 다시 시도하세요.';}
      finally {button.disabled=false;}
    };
  });
}
export async function logout(){await request('logout',{method:'POST'});location.reload();}
