import {request} from '../integrations/api.js';
import {loginPage} from '../pages/login.js';
export let sessionInfo={isAdmin:false};
export async function requireLogin() {
  try {sessionInfo=await request('session');return;}catch{}
  await new Promise(resolve=>{
    const root=document.querySelector('#app');
    root.innerHTML=loginPage();
    const password=root.querySelector('#login-password');
    const toggle=root.querySelector('.password-toggle');
    toggle.onclick=()=>{
      const visible=password.type==='password';
      password.type=visible?'text':'password';
      toggle.textContent=visible?'숨기기':'보기';
      toggle.setAttribute('aria-pressed',String(visible));
      toggle.setAttribute('aria-label',visible?'비밀번호 숨기기':'비밀번호 표시');
    };
    root.querySelector('form').onsubmit=async e=>{
      e.preventDefault();const form=e.target;const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='로그인 중…';form.setAttribute('aria-busy','true');root.querySelector('#login-error').textContent='';
      try {await request('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();sessionInfo=await request('session');resolve();}
      catch {root.querySelector('#login-error').textContent='로그인하지 못했습니다. 계정 정보를 확인하거나 잠시 후 다시 시도하세요.';}
      finally {button.disabled=false;button.innerHTML='로그인 <span aria-hidden="true">↗</span>';form.removeAttribute('aria-busy');}
    };
  });
}
export async function logout(){await request('logout',{method:'POST'});location.reload();}
