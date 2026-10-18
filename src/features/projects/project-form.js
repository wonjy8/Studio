import {icon} from '../../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../../design-system/primitives/html.js';
import {colorPicker} from '../../design-system/color-picker.js';
import {selectableProjectIcons,projectIconCategories,projectIconInfo,findProjectIcons} from '../../design-system/icons/catalog.js';
export const iconPageSize=48;
export function projectIconPage(query='',category='',page=0){
 const results=findProjectIcons(query,category),pages=Math.max(1,Math.ceil(results.length/iconPageSize));
 const current=Math.max(0,Math.min(pages-1,Number.isInteger(page)?page:0));
 return {total:results.length,pages,page:current,items:results.slice(current*iconPageSize,(current+1)*iconPageSize)};
}
function choices(items,selected){return items.map(item=>`<label class="icon-choice"><input type="radio" name="project-icon-choice" value="${esc(item.id)}" ${item.id===selected?'checked':''}><span title="${esc(item.name)}">${icon(item.id,{solid:true})}<span class="sr-only">${esc(item.name)}</span></span></label>`).join('');}
function iconPicker(selected,prefix){
 const first=projectIconPage(),id=prefix+'-icon-popover';
 return `<div class="project-icon-control" data-project-icon-picker><span class="appearance-label">아이콘</span><input type="hidden" name="icon" value="${esc(selected)}"><button type="button" class="project-icon-trigger" popovertarget="${id}" aria-label="아이콘 선택" title="${esc(projectIconInfo(selected)?.name||'아이콘')}">${icon(selected,{solid:true})}</button><div id="${id}" popover class="project-icon-popover" aria-label="프로젝트 아이콘"><div class="icon-filters"><label class="sr-only" for="${prefix}-icon-search">아이콘 검색</label><input type="search" id="${prefix}-icon-search" data-icon-search placeholder="아이콘 검색" autocomplete="off"><label class="sr-only" for="${prefix}-icon-category">분류</label><select id="${prefix}-icon-category" data-icon-category aria-label="분류"><option value="">전체</option>${projectIconCategories.map(cat=>`<option>${esc(cat)}</option>`).join('')}</select></div><div class="icon-options" data-icon-results>${choices(first.items,selected)}</div><div class="icon-pagination"><button type="button" class="btn" data-icon-prev disabled aria-label="이전 아이콘">‹</button><span data-icon-count aria-live="polite">1 / ${first.pages}</span><button type="button" class="btn" data-icon-next aria-label="다음 아이콘">›</button></div></div></div>`;
}
export function bindProjectIconPicker(root=document){
 root.querySelectorAll('[data-project-icon-picker]').forEach(picker=>{
  let page=0;
  const search=picker.querySelector('[data-icon-search]'),category=picker.querySelector('[data-icon-category]'),selected=picker.querySelector('[name="icon"]'),results=picker.querySelector('[data-icon-results]'),previous=picker.querySelector('[data-icon-prev]'),next=picker.querySelector('[data-icon-next]'),trigger=picker.querySelector('.project-icon-trigger'),popover=picker.querySelector('[popover]');
  function preview(){const color=picker.closest('form').querySelector('[name=color]:checked')?.value||'violet';trigger.className='project-icon-trigger color-'+color;trigger.style.setProperty('--project-accent','var(--'+color+')');trigger.innerHTML=icon(selected.value,{solid:true});trigger.title=projectIconInfo(selected.value)?.name||'아이콘';}
  function update(){const result=projectIconPage(search.value,category.value,page);page=result.page;results.innerHTML=choices(result.items,selected.value)||'<p class="sub">검색 결과 없음</p>';picker.querySelector('[data-icon-count]').textContent=`${page+1} / ${result.pages}`;previous.disabled=page===0;next.disabled=page===result.pages-1;}
  popover.addEventListener('beforetoggle',e=>{if(e.newState!=='open')return;const rect=trigger.getBoundingClientRect(),width=Math.min(360,innerWidth-24);popover.style.width=width+'px';popover.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';popover.style.top=Math.max(12,Math.min(rect.bottom+10,innerHeight-480))+'px';});
  popover.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();popover.hidePopover();trigger.focus();}});
  search.oninput=category.onchange=()=>{page=0;update();};
  previous.onclick=()=>{page--;update();};next.onclick=()=>{page++;update();};
  results.onchange=e=>{if(e.target.name!=='project-icon-choice')return;selected.value=e.target.value;preview();selected.dispatchEvent(new Event('input',{bubbles:true}));popover.hidePopover();trigger.focus();};
  picker.closest('form').querySelectorAll('[name=color]').forEach(input=>input.addEventListener('change',preview));preview();update();
 });
}
export function projectForm(project,creating=false){
 const prefix=creating?'new-project':'project';
 return `<h2>${creating?'새 프로젝트':'프로젝트 설정'}</h2><form class="form project-form" data-form="${creating?'new-project':'project'}"><div class="field"><label for="${prefix}-name">프로젝트 이름</label><input id="${prefix}-name" name="name" value="${creating?'':esc(project.name)}" placeholder="프로젝트 이름" required maxlength="2000"></div><div class="field"><label for="${prefix}-description">설명</label><textarea id="${prefix}-description" name="description" maxlength="2000">${creating?'':esc(project.description||'')}</textarea></div>
 <div class="project-appearance">${colorPicker(project.color||'violet')}${iconPicker(project.icon||'production',prefix)}</div>
 <div class="grid two">${[['date','촬영일'],['time','시간'],['location','장소']].map(([key,label])=>`<div class="field"><label for="${prefix}-${key}">${label}</label><input id="${prefix}-${key}" name="${key}" ${key==='date'?'type="date"':''} value="${creating?'':esc(project[key])}" maxlength="2000"></div>`).join('')}</div><button class="btn primary">${creating?'프로젝트 만들기':'변경 사항 저장'}</button></form>`;
}
