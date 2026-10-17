import {icon} from '../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {projectNavigation,tabs} from '../patterns/navigation.js';
export function appShell({state,view,open,saving,failed,body,modal}){
 const inSettings=view==='settings';
 return `<div class="app production-app">${projectNavigation(state,view,open)}${open?'<button class="sidebar-scrim" data-action="toggle-sidebar" aria-label="프로젝트 목록 닫기"></button>':''}<main class="main"><div class="project-header"><header class="topbar"><div class="project-heading"><button class="icon-button sidebar-toggle" data-action="toggle-sidebar" aria-label="프로젝트 목록 열기" aria-expanded="${open}">${icon('menu')}</button>${inSettings?icon('settings'):`<span class="project-glyph color-${esc(state.project.color)}">${icon(state.project.icon,{solid:true})}</span>`}<h1>${inSettings?'설정':esc(state.project.name)}</h1></div><div class="topbar-actions"><span class="save-indicator ${failed?'has-error':''}" role="status"><span class="connection-dot"></span>${failed?'저장 실패':saving?'저장 중…':'저장됨'}</span>${inSettings?'':`<button class="btn primary add-shoot" data-action="add-content">${icon('plus')}<span>촬영 추가</span></button>`}</div></header>${inSettings?'':tabs(view)}</div><div class="content">${body}</div></main>${modal}</div>`;
}
