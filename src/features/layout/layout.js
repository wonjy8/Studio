import {gearCategories,layoutKinds} from '../../domain/layout.js';
import {colorPicker} from '../../design-system/color-picker.js';
import {layoutIcon} from '../../design-system/primitives/layout-icons.js';
import {icon} from '../../design-system/primitives/icons.js';
import {identityColors} from '../../domain/colors.js';
import {escapeHtml as esc} from '../../design-system/primitives/html.js';
export function placementForm(state,kind='person'){
 return `<form class="form" data-form="placement"><div class="project-appearance placement-appearance">${colorPicker()}<div class="placement-kind-control"><span class="appearance-label">종류</span><button type="button" class="project-icon-trigger" data-layout-preview popovertarget="placement-kind-popover" aria-label="종류 선택">${layoutIcon(kind)}</button><span class="sub">${esc(layoutKinds[kind])}</span><div id="placement-kind-popover" class="project-icon-popover placement-kind-popover" popover aria-label="배치 종류"><fieldset class="placement-kind-picker"><legend class="sr-only">종류</legend>${Object.entries(layoutKinds).map(([key,label])=>`<label class="placement-kind-choice"><input type="radio" name="kind" value="${key}" data-placement-kind ${key===kind?'checked':''}><span aria-hidden="true">${layoutIcon(key)}</span><span>${label}</span></label>`).join('')}</fieldset></div></div></div>${kind==='table'?'<label class="field">테이블 모양<select name="shape"><option value="rectangle">사각형</option><option value="circle">원형</option></select></label>':''}<label class="field">이름<input name="name" maxlength="2000" placeholder="이름 또는 연결 항목 사용"></label>${kind==='equipment'?`<label class="field">장비<select name="gearId" required><option value="">장비 선택</option>${state.gear.map(g=>`<option value="${g.id}">${esc(gearCategories[g.category]||'기타 장비')} · ${esc(g.name)}</option>`).join('')}</select></label>`:''}${kind==='person'?`<label class="field">멤버 연결<select name="memberId"><option value="">연결 없이 배치</option>${state.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>`:''}<button class="btn primary">배치 추가</button></form>`;
}
export function bindLayoutAppearance(root=document){
 root.querySelectorAll('[data-form=placement],[data-form=position]').forEach(form=>{
  const preview=form.querySelector('[data-layout-preview]');
  if(preview){const update=()=>preview.style.setProperty('--project-accent','var(--'+(form.querySelector('[name=color]:checked')?.value||'graphite')+')');form.querySelectorAll('[name=color]').forEach(input=>input.onchange=update);update();}
  const popover=form.querySelector('[popover]');if(!popover)return;
  popover.onbeforetoggle=e=>{if(e.newState!=='open')return;const r=preview.getBoundingClientRect(),width=Math.min(300,innerWidth-24);popover.style.width=width+'px';popover.style.left=Math.max(12,Math.min(r.right-width,innerWidth-width-12))+'px';popover.style.top=Math.max(12,Math.min(r.bottom+10,innerHeight-260))+'px';};
  popover.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();popover.hidePopover();preview.focus();}};
 });
}
export function positionForm(item){
 const resizable=['table','person'].includes(item.kind),locked=item.kind==='person'||item.shape==='circle',max=item.kind==='person'?240:360;
 return `<form class="form" data-form="position" data-id="${item.id}">${item.kind?`<div class="project-appearance">${colorPicker(item.color||'graphite')}</div>`:''}<div class="grid two">${[['x','가로 위치 (%)',100],['y','세로 위치 (%)',100],...(item.kind?[['rotation','회전 (°)',360]]:[])].map(([key,label,max])=>`<label class="field">${label}<input name="${key}" type="number" min="0" max="${max}" step="1" data-precise="${item[key]}" value="${Math.round(item[key])}" required></label>`).join('')}</div>${item.kind==='table'?`<label class="field">테이블 모양<select name="shape"><option value="rectangle" ${item.shape!=='circle'?'selected':''}>사각형</option><option value="circle" ${item.shape==='circle'?'selected':''}>원형</option></select></label>`:''}${resizable?`<div class="grid two">${['width','height'].map(key=>{const size=item[key]??(item.kind==='person'?80:key==='width'||item.shape==='circle'?120:80);return `<label class="field">${key==='width'?'가로':'세로'} 크기 (px)<input name="${key}" type="number" min="48" max="${max}" step="1" data-precise="${size}" value="${Math.round(size)}" required ${key==='height'&&locked?'readonly':''}></label>`;}).join('')}</div><p class="sub">${item.kind==='person'?'사람은 정방형 크기로 아이콘 비율을 유지합니다.':'원형 테이블은 가로 크기를 기준으로 정원을 유지합니다.'}</p>`:''}<button class="btn primary">위치 저장</button><button class="btn danger" type="button" data-remove-placement="${item.id}">배치에서 제거</button></form>`;
}
// Display geometry never rewrites stored percentage coordinates or furniture sizes.
export function layoutItemGeometry(item,stageWidth,stageHeight){
 const table=['table','person'].includes(item.kind),person=item.kind==='person',padding=table?10:0;
 let width=table?(item.width??(person?80:120)):96,height=table?(item.height??(person?80:item.shape==='circle'?120:80)):80;
 if(table){const scale=Math.min(1,Math.max(1,stageWidth-padding*2)/width,Math.max(1,stageHeight-padding*2)/height);width=Math.max(48,width*scale);height=Math.max(48,height*scale);}
 const travelX=Math.max(0,stageWidth-width-padding*2),travelY=Math.max(0,stageHeight-height-padding*2);
 return {width,height,travelX,travelY,left:padding+width/2+travelX*item.x/100,top:padding+height/2+travelY*item.y/100};
}
// Pointer deltas are canvas CSS pixels. Anchor the opposite edge/corner rather
// than resizing around a percentage center. Fit is applied only at drag start.
export function resizeLayoutGeometry(start,edge,dx,dy,stageWidth,stageHeight){
 if(!['n','ne','e','se','s','sw','w','nw'].includes(edge)||![dx,dy,stageWidth,stageHeight].every(Number.isFinite))throw Error('Invalid resize geometry');
 if((dx===0&&dy===0)||stageWidth<68||stageHeight<68)return {width:start.width??(start.kind==='person'?80:120),height:start.height??(start.kind==='person'?80:start.shape==='circle'?120:80),x:start.x,y:start.y};
 const g=layoutItemGeometry(start,stageWidth,stageHeight),margin=10;
 const west=edge.includes('w'),east=edge.includes('e'),north=edge.includes('n'),south=edge.includes('s');
 const left=g.left-g.width/2,right=g.left+g.width/2,top=g.top-g.height/2,bottom=g.top+g.height/2;
 const clamp=(value,max)=>Math.max(48,Math.min(Math.max(48,max),value));
 let width=g.width,height=g.height,cx=g.left,cy=g.top;
 if(start.shape==='circle'||start.kind==='person'){
  const deltas=[...(west?[-dx]:east?[dx]:[]),...(north?[-dy]:south?[dy]:[])];
  let maximum=start.kind==='person'?240:360;
  maximum=Math.min(maximum,west?right-margin:east?stageWidth-margin-left:2*Math.min(cx-margin,stageWidth-margin-cx));
  maximum=Math.min(maximum,north?bottom-margin:south?stageHeight-margin-top:2*Math.min(cy-margin,stageHeight-margin-cy));
  width=height=clamp(g.width+deltas.reduce((a,b)=>a+b,0)/deltas.length,maximum);
  if(west)cx=right-width/2;else if(east)cx=left+width/2;
  if(north)cy=bottom-height/2;else if(south)cy=top+height/2;
 }else{
  if(west){width=clamp(g.width-dx,Math.min(360,right-margin));cx=right-width/2;}
  if(east){width=clamp(g.width+dx,Math.min(360,stageWidth-margin-left));cx=left+width/2;}
  if(north){height=clamp(g.height-dy,Math.min(360,bottom-margin));cy=bottom-height/2;}
  if(south){height=clamp(g.height+dy,Math.min(360,stageHeight-margin-top));cy=top+height/2;}
 }
 const position=(center,size,extent,original)=>{const travel=extent-size-margin*2;return travel>0?Math.max(0,Math.min(100,(center-margin-size/2)/travel*100)):original;};
 return {width,height,x:position(cx,width,stageWidth,start.x),y:position(cy,height,stageHeight,start.y)};
}
export function layoutStage(state){
 const items=[...state.cameras.map(c=>({...c,kind:'camera'})),...state.layoutObjects];
 return `<p class="sub layout-help">드래그로 이동 · 가장자리로 크기 조절 · Enter로 편집</p><div class="camera-stage" data-layout-stage aria-label="촬영 배치도">${items.map(item=>`<button class="camera layout-item layout-${item.kind}" data-layout-id="${item.id}" ${item.kind==='camera'?`data-camera="${item.id}"`:`data-placement="${item.id}"`} style="--layout-color:var(--${identityColors.includes(item.color)?item.color:'graphite'});${['table','person'].includes(item.kind)?`width:${item.width??(item.kind==='person'?80:120)}px;height:${item.height??(item.kind==='person'?80:item.shape==='circle'?120:80)}px;${item.shape==='circle'?'border-radius:50%;corner-shape:round;':''}`:''}left:calc(48px + (100% - 96px) * ${item.x/100});top:calc(40px + (100% - 80px) * ${item.y/100})" aria-label="${esc(item.name)} · ${item.kind==='camera'?'카메라':esc(layoutKinds[item.kind])}"><span class="layout-symbol" aria-hidden="true" style="transform:rotate(${item.rotation||0}deg)">${item.kind==='camera'?icon('camera',{solid:true}):layoutIcon(item.kind)}</span><b>${esc(item.name)}</b>${item.kind==='person'?'':'<small>'}${item.kind==='person'?'':item.kind==='camera'?'카메라':item.kind==='equipment'?esc(gearCategories[state.gear.find(g=>g.id===item.gearId)?.category]||'장비'):esc(layoutKinds[item.kind])}${item.kind==='person'?'':'</small>'}${['table','person'].includes(item.kind)?['n','ne','e','se','s','sw','w','nw'].map(edge=>`<span class="layout-resize layout-resize-${edge}" data-resize="${edge}" aria-hidden="true"></span>`).join(''):''}</button>`).join('')}${items.length?'':'<div class="empty">카메라나 사람·사물을 추가해 배치도를 만드세요.</div>'}</div><div class="layout-object-list" aria-label="배치 항목">${items.map(item=>`<button class="btn" ${item.kind==='camera'?`data-camera="${item.id}"`:`data-placement="${item.id}"`}>${esc(item.name)} · 위치 편집</button>`).join('')}</div>`;
}
