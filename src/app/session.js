import {safeLoginReturn} from './routes.js';
import {request} from '../integrations/api.js';
import {loginPage} from '../pages/login.js';
import {loginFailureMessage} from '../features/login-errors.js';
export let sessionInfo={isAdmin:false};
export async function requireLogin() {
  try {sessionInfo=await request('session');return;}catch{}
  const returnTo=safeLoginReturn(location.pathname+location.search+location.hash);if(location.pathname!=='/login'){history.replaceState(null,'',returnTo&&returnTo!=='/'?'/login?returnTo='+encodeURIComponent(returnTo):'/login');}
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
      let stage='login';const credentials=Object.fromEntries(new FormData(form));credentials.rememberMe=form.elements.rememberMe.checked;credentials.username=credentials.username.trim();form.elements.username.value=credentials.username;const message=root.querySelector('#login-error');delete message.dataset.loginStage;delete message.dataset.httpStatus;
      try {await request('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});stage='session';sessionInfo=await request('session');form.reset();resolve();}
      catch(error) {message.textContent=loginFailureMessage(error,stage);message.dataset.loginStage=stage;message.dataset.httpStatus=String(error.status||'network');}
      finally {button.disabled=false;button.textContent='로그인';form.removeAttribute('aria-busy');}
    };
  });
}
export async function logout(){await request('logout',{method:'POST'});location.reload();}
