import {icon} from '../../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../../design-system/primitives/html.js';
import {projectColors} from '../../domain/workspace.js';
import {projectIconCatalog,projectIconCategories,projectIconInfo,findProjectIcons} from '../../design-system/icons/catalog.js';
const colorNames={violet:'보라',blue:'파랑',orange:'주황',green:'초록',rose:'분홍',graphite:'검정'};
export const iconPageSize=48;
export function projectIconPage(query='',category='',page=0){
 const results=findProjectIcons(query,category),pages=Math.max(1,Math.ceil(results.length/iconPageSize));
 const current=Math.max(0,Math.min(pages-1,Number.isInteger(page)?page:0));
 return {total:results.length,pages,page:current,items:results.slice(current*iconPageSize,(current+1)*iconPageSize)};
}
function choices(items,selected){return items.map(item=>`<label class="icon-choice"><input type="radio" name="project-icon-choice" value="${esc(item.id)}" ${item.id===selected?'checked':''}><span title="${esc(item.name)}">${icon(item.id,{solid:true})}<span class="sr-only">${esc(item.name)}</span></span></label>`).join('');}
function selectedIcon(id){return `${icon(id,{solid:true})} <span>${esc(projectIconInfo(id)?.name||'클래퍼보드')}</span>`;}
function iconPicker(selected,prefix){
 const first=projectIconPage();
 return `<fieldset class="icon-picker" data-project-icon-picker><legend>아이콘 · ${projectIconCatalog.length.toLocaleString('ko-KR')}개</legend><input type="hidden" name="icon" value="${esc(selected)}"><p class="sub" data-icon-selected>선택: ${selectedIcon(selected)}</p><div class="grid two"><div class="field"><label for="${prefix}-icon-search">아이콘 검색</label><input type="search" id="${prefix}-icon-search" data-icon-search placeholder="카메라, 유튜브, Instagram…" autocomplete="off"></div><div class="field"><label for="${prefix}-icon-category">분류</label><select id="${prefix}-icon-category" data-icon-category><option value="">전체</option>${projectIconCategories.map(cat=>`<option>${esc(cat)}</option>`).join('')}</select></div></div><p class="sub" data-icon-count aria-live="polite">${first.total}개 · 1 / ${first.pages}페이지</p><div class="icon-options" data-icon-results>${choices(first.items,selected)}</div><div class="actions"><button type="button" class="btn" data-icon-prev disabled>이전 아이콘</button><button type="button" class="btn" data-icon-next>다음 아이콘</button></div></fieldset>`;
}
export function bindProjectIconPicker(root=document){
 root.querySelectorAll('[data-project-icon-picker]').forEach(picker=>{
  let page=0;
  const search=picker.querySelector('[data-icon-search]'),category=picker.querySelector('[data-icon-category]'),selected=picker.querySelector('[name="icon"]'),results=picker.querySelector('[data-icon-results]'),previous=picker.querySelector('[data-icon-prev]'),next=picker.querySelector('[data-icon-next]');
  function update(){const result=projectIconPage(search.value,category.value,page);page=result.page;results.innerHTML=choices(result.items,selected.value)||'<p class="sub">검색 결과가 없습니다.</p>';picker.querySelector('[data-icon-count]').textContent=`${result.total}개 · ${page+1} / ${result.pages}페이지`;previous.disabled=page===0;next.disabled=page===result.pages-1;}
  search.oninput=category.onchange=()=>{page=0;update();};
  previous.onclick=()=>{page--;update();};next.onclick=()=>{page++;update();};
  results.onchange=e=>{if(e.target.name!=='project-icon-choice')return;selected.value=e.target.value;picker.querySelector('[data-icon-selected]').innerHTML=`선택: ${selectedIcon(selected.value)}`;};
 });
}
export function projectForm(project,creating=false){
 const prefix=creating?'new-project':'project';
 return `<h2>${creating?'새 프로젝트':'프로젝트 설정'}</h2><p class="sub">${creating?'새로운 촬영 준비를 시작하세요.':'이름과 아이콘으로 프로젝트를 구분하세요.'}</p><form class="form project-form" data-form="${creating?'new-project':'project'}"><div class="field"><label for="${prefix}-name">프로젝트 이름</label><input id="${prefix}-name" name="name" value="${creating?'':esc(project.name)}" placeholder="프로젝트 이름" required maxlength="2000"></div><div class="field"><label for="${prefix}-description">설명</label><textarea id="${prefix}-description" name="description" maxlength="2000">${creating?'':esc(project.description||'')}</textarea></div>
 ${iconPicker(project.icon||'production',prefix)}
 <fieldset class="icon-picker"><legend>색상</legend><div class="color-options">${projectColors.map(color=>`<label class="color-choice"><input type="radio" name="color" value="${color}" ${color===(project.color||'violet')?'checked':''}><span class="color-${color}" title="${colorNames[color]}"><span class="sr-only">${colorNames[color]}</span>${icon('check')}</span></label>`).join('')}</div></fieldset>
 <div class="grid two">${[['date','촬영일'],['time','시간'],['location','장소']].map(([key,label])=>`<div class="field"><label for="${prefix}-${key}">${label}</label><input id="${prefix}-${key}" name="${key}" ${key==='date'?'type="date"':''} value="${creating?'':esc(project[key])}" maxlength="2000"></div>`).join('')}</div><button class="btn primary">${creating?'프로젝트 만들기':'변경 사항 저장'}</button></form>`;
}
