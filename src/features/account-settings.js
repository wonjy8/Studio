import {request} from '../integrations/api.js';
const validPassword=value=>value.length>=8&&value.length<=256&&/[A-Z]/.test(value)&&/[^\p{L}\p{N}\s]/u.test(value);
// Saves serialize so an older response cannot overwrite the latest name.
export function bindAccountSettings({account={},onNameSaved=()=>{},onPasswordChanged=()=>location.assign('/login')}={}){
 const form=document.querySelector('[data-account-profile]');if(!form)return;
 const input=form.elements.name,value=form.querySelector('[data-name-value]'),edit=form.querySelector('[data-edit-name]'),message=form.querySelector('[data-profile-message]');
 let confirmed=account.name||'',desired=confirmed,timer,running=null,finishEditing=false;
 const close=()=>{input.hidden=true;value.hidden=false;edit.hidden=false;value.textContent=confirmed||'미설정';};
 async function save(){
  clearTimeout(timer);desired=input.value.trim();if(running)return running;if(desired===confirmed){if(finishEditing)close();return;}
  running=(async()=>{try{while(desired!==confirmed){const name=desired;message.textContent='저장 중…';const result=await request('account/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});confirmed=result.name;onNameSaved(confirmed);}if(form.isConnected){message.textContent='';if(finishEditing)close();}}catch{if(form.isConnected){message.textContent='저장하지 못했습니다. Enter를 눌러 다시 시도하세요.';input.hidden=false;value.hidden=true;}}finally{running=null;}})();return running;
 }
 edit.onclick=()=>{value.hidden=true;edit.hidden=true;input.hidden=false;input.value=confirmed;finishEditing=false;input.focus();input.select();};
 input.oninput=e=>{finishEditing=false;desired=input.value.trim();clearTimeout(timer);if(!e.isComposing)timer=setTimeout(save,600);};
 input.oncompositionend=()=>{clearTimeout(timer);timer=setTimeout(save,600);};
 input.onblur=()=>{finishEditing=true;save();};
 input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();clearTimeout(timer);input.value=confirmed;desired=confirmed;finishEditing=true;close();}else if(e.key==='Enter'){e.preventDefault();finishEditing=true;save();}};
 form.onsubmit=e=>{e.preventDefault();finishEditing=true;save();};
 const passwordForm=document.querySelector('[data-password-form]'),toggle=document.querySelector('[data-toggle-password]');
 const hide=()=>{passwordForm.reset();passwordForm.hidden=true;toggle.setAttribute('aria-expanded','false');passwordForm.querySelector('[data-password-message]').textContent='';toggle.focus();};
 toggle.onclick=()=>{if(!passwordForm.hidden){hide();return;}passwordForm.hidden=false;toggle.setAttribute('aria-expanded','true');passwordForm.elements.currentPassword.focus();};
 document.querySelector('[data-cancel-password]').onclick=hide;
 passwordForm.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(passwordForm)),status=passwordForm.querySelector('[data-password-message]');if(data.password!==data.confirmation){status.textContent='새 비밀번호가 일치하지 않습니다.';return;}if(!validPassword(data.password)){status.textContent='8자 이상, 영문 대문자와 특수문자를 포함해 주세요.';return;}const button=passwordForm.querySelector('[type=submit]');button.disabled=true;status.textContent='';try{await request('account/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:data.currentPassword,password:data.password})});passwordForm.reset();onPasswordChanged();}catch(error){status.textContent=error.status===403?'현재 비밀번호를 확인해 주세요.':'비밀번호를 변경하지 못했습니다. 다시 시도하세요.';}finally{button.disabled=false;}};
}
