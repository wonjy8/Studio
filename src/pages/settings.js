import {icon} from '../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
export function settingsPage(state,session={}){
 const account={...session,...session.account},allowed=['account','connections','data'],section=allowed.includes(session.settingsSection)?session.settingsSection:'account';
 const headings={account:['계정 설정','로그인 계정과 프로필을 관리하세요.'],data:['데이터','프로젝트와 파일의 저장 위치를 확인하세요.'],connections:['외부 앱 연결','외부 앱 연결과 접근 권한을 관리하세요.']};
 const [title,description]=headings[section];
 const body=section==='account'?`<section class="settings-section" id="account"><h3>계정</h3><div class="settings-row"><div><strong>${esc(account.name||account.displayName||account.username||'로그인된 계정')}</strong><p>${esc(account.username?'@'+account.username:'현재 로그인 세션')} · ${session.isAdmin?'관리자':'일반 계정'}</p></div><button class="btn logout-button" data-action="logout">${icon('logout')}로그아웃</button></div><form class="form" data-account-profile><label class="field">표시 이름 (선택)<input name="name" value="${esc(account.name||'')}" maxlength="80" autocomplete="name"></label><button class="btn">이름 저장</button><p role="status" data-profile-message></p></form></section>`:section==='data'?`<section class="settings-section" id="data"><h3>데이터 저장</h3><div class="settings-row"><div><strong>개인 데이터</strong><p>프로젝트와 파일은 NAS에 비공개로 저장됩니다.</p></div><span class="status ok">NAS 저장</span></div></section>`:'';
 return `<div class="settings-page"><div class="page-heading"><p class="eyebrow">WORKSPACE SETTINGS</p><h2>${title}</h2><p>${description}</p></div>${body}</div>`;
}
