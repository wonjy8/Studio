import {googleTasksPanel} from './google-tasks.js';
import {personalCalendarPanel} from './google-calendar.js';
import {icon} from '../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {dateKey,addDays} from '../domain/calendar.js';

export function homeWorkspacePage({state,account}={}){
 const projects=[state,...(state?.projects||[])].filter(item=>item?.project&&!item.project.placeholder);
 const today=dateKey(),end=addDays(today,7);
 const shoots=projects.flatMap(item=>(item.contents||[]).map(shoot=>({shoot,project:item.project})))
  .filter(({shoot,project})=>{const date=shoot.date||project.date||'';return date>=today&&date<=end;})
  .sort((a,b)=>(a.shoot.date||a.project.date||'').localeCompare(b.shoot.date||b.project.date||'')||String(a.shoot.time||'').localeCompare(String(b.shoot.time||'')));
 const tasks=projects.flatMap(item=>(item.tasks||[]).filter(task=>!task.completed).map(task=>({task,project:item.project,shoot:item.contents?.find(shoot=>shoot.id===task.shootId)})))
  .sort((a,b)=>(a.task.date||'9999').localeCompare(b.task.date||'9999')||a.project.name.localeCompare(b.project.name,'ko'));
 return `<section class="home-workspace">
  <div class="home-workspace-metrics" aria-label="작업 요약">
   <article class="home-workspace-metric"><span>프로젝트</span><strong>${projects.length}</strong></article>
   <article class="home-workspace-metric"><span>앞으로 7일 촬영</span><strong>${shoots.length}</strong></article>
   <article class="home-workspace-metric"><span>남은 할 일</span><strong>${tasks.length}</strong></article>
  </div>
  <div class="home-workspace-columns">
   <section class="home-workspace-panel home-upcoming-panel"><div class="section-head"><h2>가까운 촬영</h2><span class="sub">앞으로 7일</span></div>
    <div class="home-workspace-list">${shoots.slice(0,5).map(({shoot,project})=>`<div class="home-workspace-row"><span class="home-workspace-date">${esc((shoot.date||project.date||'').replace(/-/g,'.'))}</span><span class="home-workspace-row-copy"><strong>${esc(shoot.name)}</strong><small>${esc(project.name)} · ${esc(shoot.time||'시간 미정')}</small></span></div>`).join('')||'<div class="empty">예정된 촬영이 없습니다.</div>'}</div>
   </section>
   <section class="home-workspace-panel home-qt-panel" data-home-qt aria-label="오늘 QT"><p class="sub" role="status">오늘 QT를 불러오는 중…</p></section>
   <section class="home-workspace-panel"><div class="section-head"><h2>내 프로젝트</h2><span class="sub">${projects.length}개</span></div>
    <div class="home-workspace-projects">${projects.map(item=>`<button type="button" class="home-workspace-project" data-project="${esc(item.project.id)}"><span class="project-glyph color-${esc(item.project.color)}">${icon(item.project.icon,{solid:true})}</span><span class="home-workspace-project-copy"><strong>${esc(item.project.name)}</strong><small>${(item.tasks||[]).filter(task=>!task.completed).length}개 할 일 · ${(item.contents||[]).length}개 촬영</small></span>${icon('chevron')}</button>`).join('')||'<div class="empty">아직 프로젝트가 없습니다.</div>'}</div>
   </section>
   <section class="home-workspace-panel"><div class="section-head"><h2>남은 할 일</h2><span class="sub">${tasks.length}개</span></div>
    <div class="home-workspace-list">${tasks.slice(0,6).map(({task,project,shoot})=>`<div class="home-workspace-row"><span class="home-workspace-task-mark" aria-hidden="true"></span><span class="home-workspace-row-copy"><strong>${esc(task.name)}</strong><small>${esc(project.name)}${shoot?` · ${esc(shoot.name)}`:''}${task.date?` · ${esc(task.date.replace(/-/g,'.'))}`:''}</small></span></div>`).join('')||'<div class="empty">남은 할 일이 없습니다.</div>'}</div>
   </section>

  </div>
 </section>`;
}


const homeProjects=state=>[state,...(state?.projects||[])].filter(item=>item?.project&&!item.project.placeholder);
const openAttributes=(project,view,date='')=>`data-home-open-project="${esc(project.id)}" data-home-project-view="${view}" data-home-date="${esc(date)}"`;
function scheduleRows(rows){return rows.map(({event,project})=>`<button type="button" class="home-workspace-project" ${openAttributes(project,'schedule',event.date||project.date||'')}><span class="home-workspace-date">${esc((event.date||project.date||'날짜 미정').replace(/-/g,'.'))}</span><span class="home-workspace-row-copy"><strong>${esc(event.name)}</strong><small>${[project.name,event.time,event.location].filter(Boolean).map(esc).join(' · ')}</small></span>${icon('chevron')}</button>`).join('')||'<div class="empty">예정된 일정이 없습니다.</div>';}
export function homeSchedulePage({state}={}){
 const today=dateKey(),rows=homeProjects(state).flatMap(item=>[...(item.contents||[]),...(item.schedule||[])].map(event=>({event,project:item.project}))),date=row=>row.event.date||row.project.date||'';
 const upcoming=rows.filter(row=>!date(row)||date(row)>=today).sort((a,b)=>(date(a)||'9999').localeCompare(date(b)||'9999')||String(a.event.time||'').localeCompare(String(b.event.time||'')));
 const previous=rows.filter(row=>date(row)&&date(row)<today).sort((a,b)=>date(b).localeCompare(date(a)));
 return `<section class="home-workspace home-collection" data-home-schedule><section class="home-workspace-panel"><div class="section-head"><h2>프로젝트 일정</h2><span class="sub">${upcoming.length}개</span></div><div class="home-workspace-list">${scheduleRows(upcoming)}</div>${previous.length?`<details class="home-history"><summary>지난 일정 · ${previous.length}개</summary>${scheduleRows(previous)}</details>`:''}</section>${personalCalendarPanel()}</section>`;
}
export function homeTasksPage({state}={}){
 const rows=homeProjects(state).flatMap(item=>(item.tasks||[]).map(task=>({task,project:item.project,shoot:item.contents?.find(shoot=>shoot.id===task.shootId)}))).sort((a,b)=>Number(a.task.completed)-Number(b.task.completed)||(a.task.date||'9999').localeCompare(b.task.date||'9999'));
 return `<section class="home-workspace home-collection" data-home-tasks><section class="home-workspace-panel"><div class="section-head"><h2>프로젝트 할 일</h2><span class="sub">${rows.filter(row=>!row.task.completed).length}개 남음</span></div><div class="home-workspace-list">${rows.map(({task,project,shoot})=>`<button type="button" class="home-workspace-project ${task.completed?'is-completed':''}" ${openAttributes(project,'tasks')}><span class="home-workspace-row-copy"><strong>${esc(task.name)}</strong><small>${[project.name,shoot?.name,task.date].filter(Boolean).map(esc).join(' · ')}</small></span><span class="sub">${task.completed?'완료':'미완료'}</span>${icon('chevron')}</button>`).join('')||'<div class="empty">등록된 할 일이 없습니다.</div>'}</div></section>${googleTasksPanel()}</section>`;
}
export function bindHomeProjectLinks(onOpen){document.querySelectorAll('[data-home-open-project]').forEach(button=>button.onclick=()=>onOpen(button.dataset.homeOpenProject,button.dataset.homeProjectView,button.dataset.homeDate));}
