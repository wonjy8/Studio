import {request} from '../integrations/api.js';
import {signupPage} from '../pages/signup.js';
const errors={ALREADY_SIGNED_IN:'이미 로그인되어 있습니다. 시크릿 창에서 초대 링크를 열어 가입해 주세요.',INVITE_UNAVAILABLE:'만료되었거나 사용할 수 없는 초대 링크입니다. 관리자에게 새 링크를 요청하세요.',USERNAME_FORMAT:'사용자 이름은 영문, 숫자, _, . 또는 -로 3~64자 입력하세요.',PASSWORD_POLICY:'비밀번호는 8자 이상이며 영문 대문자와 특수문자가 각각 1개 이상 필요합니다.',USERNAME_TAKEN:'이미 사용 중인 사용자 이름입니다.',RATE_LIMIT:'시도가 많습니다. 잠시 후 다시 시도하세요.'};
export async function acceptInvitation(){
 const match=location.hash.match(/^#invite=([a-f0-9]{64})$/);
 if(!location.hash.startsWith('#invite=')&&!['/signup','/signin'].includes(location.pathname))return false;
 const raw=match?.[1];history.replaceState(null,'','/signup');
 const root=document.querySelector('#app');root.innerHTML=signupPage();
 if(!raw){root.querySelector('#signup-error').textContent=errors.INVITE_UNAVAILABLE;root.querySelector('[type=submit]').disabled=true;return true;}
 root.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,data=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]'),error=root.querySelector('#signup-error');
  if(data.password!==data.confirm){error.textContent='비밀번호가 일치하지 않습니다.';return;}
  button.disabled=true;button.textContent='계정 만드는 중…';error.textContent='';
  try{await request('signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:raw,username:data.username,password:data.password,name:data.name})});await request('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:data.username,password:data.password})});form.reset();location.replace('/');}
  catch(e){error.textContent=errors[e.message]||'계정을 만들지 못했습니다. 잠시 후 다시 시도하세요.';button.disabled=false;button.textContent='계정 만들기';}
 };
 return true;
}
