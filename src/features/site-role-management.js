import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
const grades={super_admin:'최고 관리자',admin:'관리자',user:'일반 사용자'};
let activeRoles=null;
export function siteRoleManagementDraftPending(){return Boolean(activeRoles?.root.isConnected&&activeRoles.pending());}
export function siteRoleManagementCanLeave(){return !activeRoles?.root.isConnected||activeRoles.leave();}
export function siteRoleManagementPanel(session={}){
 return `<section class="card site-role-management" data-site-role-management data-can-manage="${Boolean(session.capabilities?.canManageSiteRoles??session.canManageSiteRoles)}"><div class="section-head"><div><h2>사이트 관리자 권한</h2><p class="sub">사이트 권한은 조직 역할과 별개입니다. 최고 관리자만 관리자 권한을 부여하거나 해제할 수 있습니다.</p></div></div><p role="status" data-site-role-message>${(session.capabilities?.canManageSiteRoles??session.canManageSiteRoles)?'불러오는 중…':'현재 계정에서는 관리자 권한을 변경할 수 없습니다.'}</p><div data-site-role-content></div></section>`;
}
export async function bindSiteRoleManagement(scope=document){
 const root=scope.matches?.('[data-site-role-management]')?scope:scope.querySelector('[data-site-role-management]');if(!root||root.dataset.canManage!=='true')return;
 const message=root.querySelector('[data-site-role-message]'),content=root.querySelector('[data-site-role-content]');let busy=false,uncertain=false,generation=0,lastFocus=null;
 const userPanel=document.querySelector('[data-admin-panel]');const syncSelection=()=>{const selected=userPanel?.dataset.masterSelection;if(!selected)return;root.querySelectorAll('[data-site-role-account]').forEach(node=>{node.hidden=node.dataset.siteRoleAccount!==selected;if(!node.hidden)node.open=true;});};userPanel?.addEventListener('studio-master-selection',syncSelection);
 const alive=()=>root.isConnected,snapshot=form=>JSON.stringify(Object.fromEntries(new FormData(form))),dirty=()=>[...root.querySelectorAll('[data-site-role-form]')].some(form=>snapshot(form)!==form.dataset.baseline);
 const tell=(text,error=false)=>{if(alive()){message.textContent=text;message.setAttribute('role',error?'alert':'status');}};
 root.addEventListener('focusin',event=>{if(event.target.matches('input,textarea,select'))lastFocus=event.target;});
 activeRoles={root,pending:()=>busy||uncertain||dirty(),leave:()=>{if(busy){tell('권한 변경이 끝날 때까지 기다려 주세요.',true);return false;}if((uncertain||dirty())&&!confirm('저장하지 않은 권한 변경 입력을 버리고 이동할까요?')){lastFocus?.isConnected&&lastFocus.focus();return false;}return true;}};
 function recovery(){const node=document.createElement('div');node.dataset.siteRoleRecovery='';node.innerHTML='<p class="sub">처리 여부를 확인하지 못했습니다. 권한 목록을 다시 확인하세요.</p><button class="btn" data-site-role-refresh>최신 권한 확인</button>';content.append(node);node.querySelector('button').onclick=async()=>{if(busy||!confirm('입력을 버리고 최신 권한 목록을 확인할까요?'))return;busy=true;node.querySelector('button').disabled=true;const loaded=await load();if(!alive())return;busy=false;if(loaded)uncertain=false;else node.querySelector('button').disabled=false;};}
 async function load(){
  const current=++generation;
  try{const data=await request('admin/site-roles');if(!alive()||current!==generation)return false;
   if(!data.configured){content.innerHTML='<p class="sub">최고 관리자 설정이 완료되지 않았습니다. 이 화면에서 최고 관리자를 지정하거나 전환할 수 없습니다.</p>';tell('권한 변경을 사용할 수 없습니다.');return true;}
   content.innerHTML=data.accounts.map(account=>`<details class="site-role-account" data-site-role-account="${esc(account.id)}"><summary><strong>@${esc(account.username)}</strong><span class="member-chip">${grades[account.role]||'일반 사용자'}</span></summary>${account.role==='super_admin'||account.available===false?`<p class="sub">${account.role==='super_admin'?'최고 관리자 계정은 이 화면에서 변경할 수 없습니다.':'사용할 수 없는 계정의 역할은 변경할 수 없습니다.'}</p>`:`<form class="form" data-site-role-form="${esc(account.id)}"><label class="field">사이트 역할<select name="role" aria-label="${esc(account.username)} 사이트 역할"><option value="user" ${account.role==='user'?'selected':''}>일반 사용자</option><option value="admin" ${account.role==='admin'?'selected':''}>관리자</option></select></label><label class="field">변경 사유<textarea name="reason" required minlength="3" maxlength="500"></textarea></label><label class="field">확인: @${esc(account.username)} 입력<input name="confirmUsername" required autocomplete="off"></label><button class="btn primary" type="submit">권한 변경</button><button class="btn" type="reset">입력 취소</button><p class="sub">관리자 권한을 해제하면 기존 세션에도 즉시 적용됩니다.</p></form>`}</details>`).join('');
   syncSelection();content.querySelectorAll('[data-site-role-form]').forEach(form=>{const account=data.accounts.find(account=>account.id===form.dataset.siteRoleForm);form.dataset.baseline=snapshot(form);form.onsubmit=async event=>{event.preventDefault();if(busy||uncertain)return;const values=Object.fromEntries(new FormData(form));if(values.confirmUsername!==account.username){tell('확인용 사용자 이름이 일치하지 않습니다.',true);return;}if(!values.reason.trim()||values.reason.trim().length<3){tell('변경 사유를 세 글자 이상 입력하세요.',true);return;}if(values.role===account.role){tell('현재 역할과 다른 역할을 선택하세요.',true);return;}if(!confirm(`@${account.username} 계정의 사이트 역할을 ${grades[values.role]}로 변경할까요?`))return;
    busy=true;root.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=true);tell('권한 변경 중…');
    try{await request(`admin/site-roles/${encodeURIComponent(account.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,revision:account.revision})});if(!alive())return;const loaded=await load();if(alive()){if(loaded)tell('사이트 역할이 변경됐습니다.');else{uncertain=true;recovery();}}}
    catch(error){if(!alive())return;tell(error.message,true);if(!error.status||error.status>=500){uncertain=true;recovery();}else{root.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=false);if(error.status===409){const reload=document.createElement('button');reload.className='btn';reload.type='button';reload.textContent='최신 권한 확인';reload.onclick=async()=>{if(busy||!confirm('입력을 버리고 최신 권한 목록을 확인할까요?'))return;busy=true;root.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=true);const loaded=await load();if(!alive())return;busy=false;if(!loaded)root.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=false);};content.append(reload);}}}
    finally{busy=false;}
   };});tell('');return true;
  }catch(error){if(alive()&&current===generation)tell(error.message,true);return false;}
 }
 await load();
}
