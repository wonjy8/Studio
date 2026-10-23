import {request} from '../integrations/api.js';
import {adminPanel,bindAdmin} from './accounts.js';
import {contactsPage,bindContacts,contactsCanLeave} from './contacts.js';
import {adminOrganizationsPage,bindAdminOrganizations,adminOrganizationsCanLeave} from './admin-organizations.js';
import {siteRoleManagementPanel,bindSiteRoleManagement,siteRoleManagementCanLeave} from './site-role-management.js';
import {accountDeletionCanLeave} from './account-permanent-deletion.js';
import {sessionInfo} from '../app/session.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export const adminDirectoryPage=()=>`<section class="admin-directory browse-workspace" data-admin-directory><nav class="workspace-browse-tabs" aria-label="사용자 분류">${[['users','가입자'],['organizations','조직'],['contacts','비가입자']].map(([key,label])=>`<button type="button" class="project-tab ${key==='users'?'active':''}" data-directory-tab="${key}" aria-current="${key==='users'?'page':'false'}">${label}</button>`).join('')}</nav><div class="browse-toolbar"><button class="btn" type="button" data-directory-back hidden>← 목록</button><label class="field browse-search">검색<input type="search" placeholder="이름·아이디·조직" data-directory-search></label><div data-directory-actions></div></div><p role="status" data-directory-message></p><div data-directory-recovery></div><div class="browse-list" data-directory-groups></div><section class="directory-sources browse-detail" hidden><section data-directory-source="users">${adminPanel()}${sessionInfo.canManageSiteRoles?siteRoleManagementPanel(sessionInfo):''}</section><section data-directory-source="organizations" hidden>${adminOrganizationsPage()}</section><section data-directory-source="contacts" hidden>${contactsPage()}</section></section></section>`;
export async function bindAdminDirectory(){const root=document.querySelector('[data-admin-directory]');if(!root)return;const groups=root.querySelector('[data-directory-groups]');let selected='',filter='',memberRecords=[],activeGroup='users',loading=false;const loadErrors={};const definitions=[['users','가입자','[data-admin-users] .master-choice'],['organizations','조직','[data-admin-org-list] button'],['contacts','비가입자','[data-contact-list] button']];const canLeave=()=>contactsCanLeave()&&adminOrganizationsCanLeave()&&siteRoleManagementCanLeave()&&accountDeletionCanLeave();
 function showList(){const message=root.querySelector('[data-directory-message]');message.textContent=[...root.querySelectorAll('[data-directory-source="'+activeGroup+'"] [role=status],[data-directory-source="'+activeGroup+'"] [role=alert]')].map(node=>node.textContent.trim()).filter(Boolean).join(' ');root.querySelector('.directory-sources').hidden=true;groups.hidden=false;root.querySelector('[data-directory-back]').hidden=true;root.querySelector('.browse-search').hidden=false;root.querySelector('[data-directory-actions]').hidden=false;}
 function choose(group,button,key){if(!canLeave())return false;selected=key;root.querySelector('[data-directory-message]').textContent='';for(const panel of root.querySelectorAll('[data-directory-source]'))panel.hidden=panel.dataset.directorySource!==group;root.querySelector('.directory-sources').hidden=false;groups.hidden=true;root.querySelector('[data-directory-back]').hidden=false;root.querySelector('.browse-search').hidden=true;root.querySelector('[data-directory-actions]').hidden=true;button?.click();draw();root.querySelector('[data-directory-back]').focus();return true;}
 function syncTabs(){
  for(const tab of root.querySelectorAll('[data-directory-tab]')){
   const active=tab.dataset.directoryTab===activeGroup;
   tab.classList.toggle('active',active);
   if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  }
 }
 function draw(){
  if(!root.isConnected||loading)return;
  groups.replaceChildren();
  const failure=loadErrors[activeGroup],recovery=root.querySelector('[data-directory-recovery]');
  recovery.replaceChildren();
  if(failure){
   const message=root.querySelector('[data-directory-message]');
   message.setAttribute('role','alert');
   message.textContent=failure.status===403?'이 목록을 조회할 권한이 없습니다. 권한을 확인한 뒤 다시 시도하세요.':failure.status===401?'로그인이 만료되었습니다. 다시 로그인한 뒤 목록을 확인하세요.':'목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.';
   root.querySelector('[data-directory-actions]').replaceChildren();
   const retry=document.createElement('button');
   retry.type='button';retry.className='btn';retry.textContent='다시 불러오기';retry.dataset.directoryRetry='';
   retry.onclick=()=>{if(canLeave())void loadSources();};
   recovery.append(retry);syncTabs();return;
  }
  root.querySelector('[data-directory-message]').setAttribute('role','status');
  const [group,label,selector]=definitions.find(([key])=>key===activeGroup),source=root.querySelector('[data-directory-source="'+group+'"]'),buttons=[...source.querySelectorAll(selector)],section=document.createElement('section');section.className='directory-group';section.setAttribute('aria-label',label);let count=0;
 for(const button of buttons){const id=button.dataset.masterId||button.dataset.adminOrg||button.dataset.orgId||button.dataset.contactId,record=memberRecords.find(c=>group==='users'?c.accountId===id:c.id===id),searchText=[button.textContent,record?.name,record?.phone,record?.email,record?.role].filter(Boolean).join(' ');if(!searchText.toLowerCase().includes(filter))continue;count++;const key=group+':'+(id||button.textContent),proxy=document.createElement('button');proxy.type='button';proxy.className='browse-row';proxy.dataset.directoryItem=key;const heading=button.querySelector('strong')?.textContent||button.textContent.split(' · ')[0],sub=[...new Set([button.querySelector('.sub')?.textContent||(group==='users'?button.textContent.split(' · ').slice(1).join(' · '):''),record?.role,record?.phone,record?.email].filter(Boolean))];proxy.innerHTML=`<span class="browse-row-content"><strong>${esc(heading)}</strong>${sub.map(value=>`<span class="sub">${esc(value)}</span>`).join('')}</span><span aria-hidden="true" class="browse-chevron">›</span>`;proxy.onclick=()=>choose(group,button,key);section.append(proxy);}
 if(!count)section.innerHTML='<p class="workspace-empty-list">'+(filter?'검색 결과가 없습니다.':'등록된 항목이 없습니다.')+'</p>';groups.append(section);
 const actions=root.querySelector('[data-directory-actions]');actions.innerHTML=group==='users'?'':`<button class="btn" type="button" data-directory-new="${group}">+ ${group==='contacts'?'멤버':'조직'}</button>`;actions.querySelector('button')?.addEventListener('click',()=>{if(!choose(group,null,group+':new'))return;source.querySelector(group==='contacts'?'[data-new-contact]':'[data-admin-org-new]')?.click();});
 syncTabs();}
 root.querySelector('[data-directory-back]').onclick=()=>{if(!canLeave())return;showList();draw();[...groups.querySelectorAll('[data-directory-item]')].find(node=>node.dataset.directoryItem===selected)?.focus();};
 root.querySelectorAll('[data-directory-tab]').forEach(tab=>tab.onclick=()=>{if(tab.dataset.directoryTab===activeGroup)return;if(!canLeave())return;activeGroup=tab.dataset.directoryTab;filter='';root.querySelector('[data-directory-search]').value='';showList();draw();});

 function decorateSubscribers(){for(const node of root.querySelectorAll('[data-admin-user-detail]')){if(node.querySelector('[data-subscriber-member-profile]'))continue;const id=node.dataset.adminUserDetail,records=memberRecords.filter(c=>c.accountId===id),section=document.createElement('section');section.dataset.subscriberMemberProfile='';section.className='subscriber-member-profile';section.innerHTML=`<h3>멤버 정보</h3>${records.map(record=>`<article><dl>${[['role','호칭'],['phone','연락처'],['email','이메일'],['notes','메모']].filter(([key])=>record[key]).map(([key,label])=>`<div class="property-row"><dt>${label}</dt><dd>${esc(record[key])}</dd></div>`).join('')}</dl><button type="button" class="btn" data-edit-member-record="${esc(record.id)}">멤버 정보 수정</button></article>`).join('')||'<button type="button" class="btn" data-create-member-record>멤버 정보 등록</button>'}`;const openMember=detail=>{if(!canLeave())return;root.querySelector('.directory-sources').hidden=false;for(const panel of root.querySelectorAll('[data-directory-source]'))panel.hidden=panel.dataset.directorySource!=='contacts';root.querySelector('[data-contacts]').dispatchEvent(new CustomEvent('studio-contact-select',{detail:{...detail,skipGuard:true}}));};section.querySelectorAll('[data-edit-member-record]').forEach(button=>button.onclick=()=>openMember({id:button.dataset.editMemberRecord}));section.querySelector('[data-create-member-record]')?.addEventListener('click',()=>{const values=node.querySelectorAll('.property-value'),username=values[1]?.textContent.trim().replace(/^@/,'')||'',name=values[0]?.textContent.trim();openMember({account:{id,username,name:name==='미설정'?username:name||username}});});const anchor=node.querySelector('.admin-danger-actions');if(anchor)anchor.before(section);else node.append(section);}}
 root.addEventListener('studio-account-deleted',async()=>{selected='';root.inert=true;try{await Promise.all([bindAdmin(),bindContacts({admin:true}),bindAdminOrganizations()]);if(!root.isConnected)return;memberRecords=(await request('admin/contacts')).contacts;decorateSubscribers();showList();draw();root.querySelector('[data-directory-message]').textContent='계정과 개인 자료가 영구삭제됐습니다. 앱에서 복구할 수 없습니다.';root.inert=false;}catch{showList();root.querySelector('[data-directory-message]').textContent='계정은 삭제됐습니다. 목록을 새로고침해 주세요.';}finally{root.inert=false;}});
 async function loadSources(){
  if(loading||!root.isConnected)return;
  loading=true;root.inert=true;root.setAttribute('aria-busy','true');
  for(const key of ['users','contacts','organizations'])delete loadErrors[key];
  showList();groups.textContent='목록을 불러오는 중…';
  try{
   const [,contactData]=await Promise.all([
    bindAdmin({onLoadError:error=>{loadErrors.users=error;}}),
    bindContacts({admin:true,onLoadError:error=>{loadErrors.contacts=error;}}),
    bindAdminOrganizations({onLoadError:error=>{loadErrors.organizations=error;}})
   ]);
   if(!root.isConnected)return;
   memberRecords=contactData?.contacts||[];
   if(sessionInfo.canManageSiteRoles)void bindSiteRoleManagement(root.querySelector('[data-site-role-management]'));
   decorateSubscribers();showList();draw();
  }finally{loading=false;if(root.isConnected){root.inert=false;root.removeAttribute('aria-busy');showList();draw();}}
 }
 root.querySelector('[data-directory-search]').oninput=e=>{filter=e.target.value.toLowerCase();draw();};await loadSources();if(!root.isConnected)return;const observer=new MutationObserver(()=>{decorateSubscribers();draw();});root.addEventListener('studio-contact-saved',async()=>{try{memberRecords=(await request('admin/contacts')).contacts;if(!root.isConnected)return;root.querySelectorAll('[data-subscriber-member-profile]').forEach(node=>node.remove());decorateSubscribers();draw();}catch{}});for(const selector of ['[data-admin-users]','[data-admin-org-list]','[data-contact-list]']){const node=root.querySelector(selector);if(node)observer.observe(node,{childList:true,subtree:true});}const stop=new MutationObserver(()=>{if(!root.isConnected){observer.disconnect();stop.disconnect();}});stop.observe(document.body,{childList:true,subtree:true});}
