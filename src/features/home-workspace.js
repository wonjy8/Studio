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
 const name=account?.name||account?.username||'';
 return `<section class="home-workspace">
  <header class="home-workspace-heading"><div><p class="eyebrow">${new Intl.DateTimeFormat('ko-KR',{dateStyle:'full'}).format(new Date())}</p><h2>${name?`안녕하세요, ${esc(name)}님`:'홈'}</h2><p class="sub">프로젝트 현황을 살펴보고 개인 문서를 이어서 작업하세요.</p></div><div class="home-workspace-actions"><button class="btn" data-view="document-workspace">${icon('tabler-file-text')} 내 문서</button><button class="btn primary" data-action="add-project">${icon('plus')} 프로젝트 추가</button></div></header>
  <div class="home-workspace-metrics" aria-label="작업 요약">
   <article class="home-workspace-metric"><span>프로젝트</span><strong>${projects.length}</strong></article>
   <article class="home-workspace-metric"><span>앞으로 7일 촬영</span><strong>${shoots.length}</strong></article>
   <article class="home-workspace-metric"><span>남은 할 일</span><strong>${tasks.length}</strong></article>
  </div>
  <div class="home-workspace-columns">
   <section class="home-workspace-panel"><div class="section-head"><h2>내 프로젝트</h2><span class="sub">${projects.length}개</span></div>
    <div class="home-workspace-projects">${projects.map(item=>`<button type="button" class="home-workspace-project" data-project="${esc(item.project.id)}"><span class="project-glyph color-${esc(item.project.color)}">${icon(item.project.icon,{solid:true})}</span><span class="home-workspace-project-copy"><strong>${esc(item.project.name)}</strong><small>${(item.tasks||[]).filter(task=>!task.completed).length}개 할 일 · ${(item.contents||[]).length}개 촬영</small></span>${icon('chevron')}</button>`).join('')||'<div class="empty">아직 프로젝트가 없습니다.</div>'}</div>
   </section>
   <section class="home-workspace-panel"><div class="section-head"><h2>가까운 촬영</h2><span class="sub">앞으로 7일</span></div>
    <div class="home-workspace-list">${shoots.slice(0,5).map(({shoot,project})=>`<div class="home-workspace-row"><span class="home-workspace-date">${esc((shoot.date||project.date||'').replace(/-/g,'.'))}</span><span class="home-workspace-row-copy"><strong>${esc(shoot.name)}</strong><small>${esc(project.name)} · ${esc(shoot.time||'시간 미정')}</small></span></div>`).join('')||'<div class="empty">예정된 촬영이 없습니다.</div>'}</div>
   </section>
   <section class="home-workspace-panel"><div class="section-head"><h2>남은 할 일</h2><span class="sub">${tasks.length}개</span></div>
    <div class="home-workspace-list">${tasks.slice(0,6).map(({task,project,shoot})=>`<div class="home-workspace-row"><span class="home-workspace-task-mark" aria-hidden="true"></span><span class="home-workspace-row-copy"><strong>${esc(task.name)}</strong><small>${esc(project.name)}${shoot?` · ${esc(shoot.name)}`:''}${task.date?` · ${esc(task.date.replace(/-/g,'.'))}`:''}</small></span></div>`).join('')||'<div class="empty">남은 할 일이 없습니다.</div>'}</div>
   </section>
   <section class="home-workspace-panel home-workspace-personal"><div class="section-head"><h2>개인 작업 공간</h2>${icon('tabler-file-text')}</div><p class="sub">프로젝트에 연결하지 않고 저장한 문서를 모아보고 계속 편집할 수 있습니다.</p><button class="btn" data-view="document-workspace">내 문서 열기 ${icon('chevron')}</button></section>
  </div>
 </section>`;
}
