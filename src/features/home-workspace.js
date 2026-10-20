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
 const totalTasks=projects.reduce((sum,item)=>sum+(item.tasks||[]).length,0),completed=totalTasks-tasks.length;
 const projectProgress=item=>{const all=item.tasks||[],done=all.filter(task=>task.completed).length;return {all:all.length,done,percent:all.length?Math.round(done/all.length*100):0};};
 const shortcut=(view,title,detail)=>`<button type="button" class="home-shortcut" data-view="${view}"><span>${title}</span><small>${detail}</small>${icon('chevron')}</button>`;
 return `<section class="home-workspace home-command">
  <div class="home-command-brand"><span class="home-brand-mark" aria-hidden="true">${icon('production',{solid:true})}</span><h2>JONGYOU<span>STUDIO</span></h2></div>
  <section class="home-workspace-panel home-project-directory"><div class="section-head"><h2>내 프로젝트</h2><span class="home-count">${projects.length} PROJECTS</span></div>
   <div class="home-workspace-projects">${projects.map(item=>{const progress=projectProgress(item);return `<button type="button" class="home-workspace-project" data-project="${esc(item.project.id)}"><span class="home-project-dot" aria-hidden="true"></span><span class="home-workspace-project-copy"><strong>${esc(item.project.name)}</strong><small>${(item.contents||[]).length}개 촬영 · ${progress.all-progress.done}개 남은 할 일</small></span><span class="home-project-progress"><span>${progress.all?progress.percent+'% 완료':'시작 전'}</span><span class="home-progress-track" aria-hidden="true"><span style="width:${progress.percent}%"></span></span></span>${icon('chevron')}</button>`;}).join('')||'<div class="empty">아직 프로젝트가 없습니다.</div>'}</div>
  </section>
  <section class="home-workspace-panel home-command-center"><div class="section-head"><h2>오늘의 작업</h2><button class="home-section-link" data-view="workspace-schedule">일정 보기 ${icon('chevron')}</button></div>
   <div class="home-workspace-metrics" aria-label="작업 요약">
    <article class="home-workspace-metric"><span>PROJECTS · 프로젝트</span><strong>${projects.length}</strong></article>
    <article class="home-workspace-metric"><span>UPCOMING · 7일 촬영</span><strong>${shoots.length}</strong></article>
    <article class="home-workspace-metric"><span>TO DO · 남은 할 일</span><strong>${tasks.length}</strong></article>
    <article class="home-workspace-metric"><span>DONE · 완료한 할 일</span><strong>${completed}</strong></article>
   </div>
   <div class="home-workspace-columns">
    <section class="home-upcoming-panel"><div class="section-head"><h3>가까운 촬영</h3><span class="sub">앞으로 7일</span></div><div class="home-workspace-list">${shoots.slice(0,5).map(({shoot,project})=>`<button type="button" class="home-workspace-row" ${openAttributes(project,'schedule',shoot.date||project.date||'')}><span class="home-workspace-date">${esc((shoot.date||project.date||'').slice(5).replace('-','.'))}</span><span class="home-workspace-row-copy"><strong>${esc(shoot.name)}</strong><small>${esc(project.name)} · ${esc(shoot.time||'시간 미정')}</small></span>${icon('chevron')}</button>`).join('')||'<div class="empty">예정된 촬영이 없습니다.</div>'}</div></section>
    <section class="home-qt-panel" data-home-qt aria-label="오늘 QT"><p class="sub" role="status">오늘 QT를 불러오는 중…</p></section>
   </div>
   <section class="home-pending-tasks"><div class="section-head"><h3>남은 할 일</h3><button class="home-section-link" data-view="workspace-tasks">전체 보기 ${icon('chevron')}</button></div><div class="home-workspace-list">${tasks.slice(0,5).map(({task,project,shoot})=>`<button type="button" class="home-workspace-row" ${openAttributes(project,'tasks')}><span class="home-workspace-task-mark" aria-hidden="true"></span><span class="home-workspace-row-copy"><strong>${esc(task.name)}</strong><small>${esc(project.name)}${shoot?` · ${esc(shoot.name)}`:''}</small></span>${task.date?`<span class="home-task-date">${esc(task.date.slice(5).replace('-','.'))}</span>`:''}${icon('chevron')}</button>`).join('')||'<div class="empty">남은 할 일이 없습니다.</div>'}</div></section>
  </section>
  <div class="home-destinations">
   <section class="home-workspace-panel"><div class="section-head"><h2>PRODUCTION <small>제작</small></h2></div>${shortcut('workspace-schedule','일정','촬영과 프로젝트 일정')}${shortcut('workspace-tasks','할 일','진행할 작업')}</section>
   <section class="home-workspace-panel"><div class="section-head"><h2>RESOURCES <small>자료</small></h2></div>${shortcut('materials','모든 자료','파일 · 문서 · 레퍼런스')}${shortcut('member-equipment','장비','멤버 · 조직 장비')}</section>
   <section class="home-workspace-panel"><div class="section-head"><h2>PERSONAL <small>기록</small></h2></div>${shortcut('scripture-qt','QT','오늘의 말씀과 묵상')}${shortcut('scripture-prayers','기도제목','나와 함께하는 사람들')}</section>
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
