import {gearCategories,layoutKinds} from '../../domain/layout.js';
import {escapeHtml as esc} from '../../design-system/primitives/html.js';
const symbols={person:'<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><circle cx="12" cy="5" r="3"/><path d="M7 10q5-3 10 0l2 7h-4v7h-6v-7H5z"/></svg>',table:'▰',chair:'▱',stage:'▤',equipment:'◇',other:'○'};
export function placementForm(state,kind='person'){
 return `<form class="form" data-form="placement"><fieldset class="placement-kind-picker"><legend>종류</legend>${Object.entries(layoutKinds).map(([key,label])=>`<label class="placement-kind-choice"><input type="radio" name="kind" value="${key}" data-placement-kind ${key===kind?'checked':''}><span aria-hidden="true">${symbols[key]}</span><span>${label}</span></label>`).join('')}</fieldset>${kind==='table'?'<label class="field">테이블 모양<select name="shape"><option value="rectangle">사각형</option><option value="circle">원형</option></select></label>':''}<label class="field">이름<input name="name" maxlength="2000" placeholder="비워 두면 연결된 항목의 이름을 사용합니다"></label>${kind==='equipment'?`<label class="field">등록된 장비<select name="gearId" required><option value="">장비 선택</option>${state.gear.map(g=>`<option value="${g.id}">${esc(gearCategories[g.category]||'기타 장비')} · ${esc(g.name)}</option>`).join('')}</select></label><p class="sub">카메라·조명·삼각대·SD 카드는 장비 탭에서 등록합니다.</p>`:''}${kind==='person'?`<label class="field">멤버 연결<select name="memberId"><option value="">연결 없이 배치</option>${state.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>`:''}<button class="btn primary">배치 추가</button></form>`;
}
export function positionForm(item){
 const resizable=['table','person'].includes(item.kind),locked=item.kind==='person'||item.shape==='circle',max=item.kind==='person'?240:360;
 return `<form class="form" data-form="position" data-id="${item.id}"><div class="grid two">${[['x','가로 위치 (%)',100],['y','세로 위치 (%)',100],...(item.kind?[['rotation','회전 (°)',360]]:[])].map(([key,label,max])=>`<label class="field">${label}<input name="${key}" type="number" min="0" max="${max}" step="1" data-precise="${item[key]}" value="${Math.round(item[key])}" required></label>`).join('')}</div>${item.kind==='table'?`<label class="field">테이블 모양<select name="shape"><option value="rectangle" ${item.shape!=='circle'?'selected':''}>사각형</option><option value="circle" ${item.shape==='circle'?'selected':''}>원형</option></select></label>`:''}${resizable?`<div class="grid two">${['width','height'].map(key=>{const size=item[key]??(item.kind==='person'?80:key==='width'||item.shape==='circle'?120:80);return `<label class="field">${key==='width'?'가로':'세로'} 크기 (px)<input name="${key}" type="number" min="48" max="${max}" step="1" data-precise="${size}" value="${Math.round(size)}" required ${key==='height'&&locked?'readonly':''}></label>`;}).join('')}</div><p class="sub">${item.kind==='person'?'사람은 정방형 크기로 아이콘 비율을 유지합니다.':'원형 테이블은 가로 크기를 기준으로 정원을 유지합니다.'}</p>`:''}<button class="btn primary">위치 저장</button><button class="btn danger" type="button" data-remove-placement="${item.id}">배치에서 제거</button></form>`;
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
 return `<p class="sub layout-help">항목을 드래그해 이동하세요. 방향키로 1%, Shift + 방향키로 5% 이동하며, 항목을 선택하면 사각 핸들이 표시됩니다. 테이블·사람 가장자리와 모서리를 드래그해 크기를 바꾸세요. Enter 또는 더블클릭으로 위치·크기를 입력합니다.</p><div class="camera-stage" data-layout-stage aria-label="촬영 배치도">${items.map(item=>`<button class="camera layout-item layout-${item.kind}" data-layout-id="${item.id}" ${item.kind==='camera'?`data-camera="${item.id}"`:`data-placement="${item.id}"`} style="${['table','person'].includes(item.kind)?`width:${item.width??(item.kind==='person'?80:120)}px;height:${item.height??(item.kind==='person'?80:item.shape==='circle'?120:80)}px;${item.shape==='circle'?'border-radius:50%;corner-shape:round;':''}`:''}left:calc(48px + (100% - 96px) * ${item.x/100});top:calc(40px + (100% - 80px) * ${item.y/100})" aria-label="${esc(item.name)} · ${item.kind==='camera'?'카메라':esc(layoutKinds[item.kind])}"><span class="layout-symbol" aria-hidden="true" style="transform:rotate(${item.rotation||0}deg)">${item.kind==='camera'?'▣':symbols[item.kind]}</span><b>${esc(item.name)}</b>${item.kind==='person'?'':'<small>'}${item.kind==='person'?'':item.kind==='camera'?'카메라':item.kind==='equipment'?esc(gearCategories[state.gear.find(g=>g.id===item.gearId)?.category]||'장비'):esc(layoutKinds[item.kind])}${item.kind==='person'?'':'</small>'}${['table','person'].includes(item.kind)?['n','ne','e','se','s','sw','w','nw'].map(edge=>`<span class="layout-resize layout-resize-${edge}" data-resize="${edge}" aria-hidden="true"></span>`).join(''):''}</button>`).join('')}${items.length?'':'<div class="empty">카메라나 사람·사물을 추가해 배치도를 만드세요.</div>'}</div><div class="layout-object-list" aria-label="배치 항목">${items.map(item=>`<button class="btn" ${item.kind==='camera'?`data-camera="${item.id}"`:`data-placement="${item.id}"`}>${esc(item.name)} · 위치 편집</button>`).join('')}</div>`;
}
