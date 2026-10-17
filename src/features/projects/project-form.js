import {icon} from '../../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../../design-system/primitives/html.js';
import {projectIcons,projectColors} from '../../domain/workspace.js';
const iconNames={production:'클래퍼보드',play:'재생',book:'책',camera:'카메라',folder:'폴더',sparkle:'별'};
const colorNames={violet:'보라',blue:'파랑',orange:'주황',green:'초록',rose:'분홍',graphite:'검정'};
export function projectForm(project,creating=false){
 return `<h2>${creating?'새 프로젝트':'프로젝트 설정'}</h2><p class="sub">${creating?'새로운 촬영 준비를 시작하세요.':'이름과 아이콘으로 프로젝트를 구분하세요.'}</p><form class="form project-form" data-form="${creating?'new-project':'project'}"><div class="field"><label for="project-name">프로젝트 이름</label><input id="project-name" name="name" value="${creating?'':esc(project.name)}" placeholder="프로젝트 이름" required maxlength="2000"></div>
 <fieldset class="icon-picker"><legend>아이콘</legend><div class="icon-options">${projectIcons.map(name=>`<label class="icon-choice"><input type="radio" name="icon" value="${name}" ${name===(project.icon||'production')?'checked':''}><span title="${iconNames[name]}">${icon(name,{solid:true})}<span class="sr-only">${iconNames[name]}</span></span></label>`).join('')}</div></fieldset>
 <fieldset class="icon-picker"><legend>색상</legend><div class="color-options">${projectColors.map(color=>`<label class="color-choice"><input type="radio" name="color" value="${color}" ${color===(project.color||'violet')?'checked':''}><span class="color-${color}" title="${colorNames[color]}"><span class="sr-only">${colorNames[color]}</span>${icon('check')}</span></label>`).join('')}</div></fieldset>
 <div class="grid two">${[['date','촬영일'],['time','시간'],['location','장소']].map(([key,label])=>`<div class="field"><label for="project-${key}">${label}</label><input id="project-${key}" name="${key}" ${key==='date'?'type="date"':''} value="${creating?'':esc(project[key])}" maxlength="2000"></div>`).join('')}</div><button class="btn primary">${creating?'프로젝트 만들기':'변경 사항 저장'}</button></form>`;
}
