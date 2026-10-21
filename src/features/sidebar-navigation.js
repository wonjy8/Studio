import {createMobileWorkspaceNavigation} from './mobile-workspace-navigation.js';
import {refreshMobileNavigationBackdrop} from './mobile-navigation-backdrop.js';
import {normalizeSidebarPreferences,orderSidebarItems,mergeSidebarOrder} from '../domain/sidebar-preferences.js';
const groupNames={'프로젝트 목록':'projects','공유 프로젝트':'shared'};
const itemKey=button=>button.dataset.project?'project:'+button.dataset.project:button.dataset.openShared?'shared:'+button.dataset.openShared:button.dataset.settingsSection?'setting:'+button.dataset.settingsSection:button.dataset.view||button.dataset.action;
export function createSidebarNavigation({account,setMobileOpen}){
 const storageKey='studio.sidebar.v1:'+account,mobile=matchMedia('(max-width:900px)');let preferences;
 try{preferences=normalizeSidebarPreferences(JSON.parse(localStorage.getItem(storageKey)));}catch{preferences=normalizeSidebarPreferences(null);}
 let pendingOpen=null,gesture=null,suppressed=null,keyboardBaseline=window.innerHeight;
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{/* Keep the current session usable when browser storage is unavailable. */}};
 const sidebar=()=>document.querySelector('.workspace-sidebar');
 const mobileNavigation=createMobileWorkspaceNavigation({sidebar,mobile,setMobileOpen});
 const items=group=>[...group.querySelectorAll('[data-sidebar-key]')].filter(item=>item.closest('[data-sidebar-sort]')===group);
 const activeRail=()=>sidebar()?.querySelector('.workspace-rail .rail-button.active');
 function sync(){
  refreshMobileNavigationBackdrop();const node=sidebar();if(!node)return;const expanded=mobile.matches?node.classList.contains('is-open'):!preferences.collapsed,panel=node.querySelector('.project-sidebar');
  const rail=node.querySelector('.workspace-rail'),railHidden=mobile.matches&&(document.body.classList.contains('mobile-keyboard-open')||Boolean(document.querySelector('.modal-wrap')));rail.inert=railHidden;rail.setAttribute('aria-hidden',String(railHidden));
  const main=document.querySelector('.production-app > .main');if(main)main.inert=mobile.matches&&expanded;
  document.querySelector('.production-app')?.classList.toggle('sidebar-collapsed',preferences.collapsed);
  if(mobile.matches){const active=activeRail();if(active){const left=active.offsetLeft,right=left+active.offsetWidth;if(left<rail.scrollLeft)rail.scrollLeft=left;else if(right>rail.scrollLeft+rail.clientWidth)rail.scrollLeft=right-rail.clientWidth;}}
  panel.id='workspace-secondary-sidebar';panel.inert=!expanded;panel.setAttribute('aria-hidden',String(!expanded));
  for(const button of node.querySelectorAll('.rail-button')){button.setAttribute('aria-pressed',String(button.classList.contains('active')));button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded',String(expanded&&button.classList.contains('active')));}
  mobileNavigation.sync();
 }
 function bottomSlots(rail){const entries=[...rail.querySelectorAll('.rail-button')],count=Number(rail.dataset.bottomSlots||0);entries.forEach((button,index)=>button.toggleAttribute('data-sidebar-bottom-start',count>0&&index===entries.length-count));}
 function prepare(group,name){
  group.dataset.sidebarSort=name;for(const button of group.querySelectorAll(':scope > button')){const key=itemKey(button);if(!key)continue;button.dataset.sidebarKey=key;button.draggable=false;button.setAttribute('aria-description','드래그하거나 Alt와 위아래 방향키로 순서를 변경합니다.');}
  for(const button of orderSidebarItems(items(group),preferences.orders[name],item=>item.dataset.sidebarKey))group.append(button);
 }
 function refresh(){
  if(gesture&&!gesture.item.isConnected)finish(false);
  const node=sidebar();if(!node)return;node.querySelector('.sidebar-heading h2')?.setAttribute('tabindex','-1');const rail=node.querySelector('.workspace-rail'),bottom=rail.querySelector('.rail-bottom');
  if(bottom){rail.dataset.bottomSlots=String(bottom.querySelectorAll('.rail-button').length);for(const button of bottom.querySelectorAll('.rail-button'))rail.append(button);bottom.remove();}
  for(const button of rail.querySelectorAll('.rail-button'))if(!button.querySelector('.rail-label')){const label=document.createElement('span');label.className='rail-label';label.textContent=button.dataset.view==='admin'?'관리자':button.title||button.getAttribute('aria-label');button.append(label);}
  for(const button of rail.querySelectorAll('.rail-button')){button.dataset.sidebarKey=itemKey(button);button.draggable=false;}bottomSlots(rail);
  for(const group of node.querySelectorAll('.project-sidebar nav.project-list')){const name=groupNames[group.getAttribute('aria-label')];if(name)prepare(group,name);}
  if(!node.querySelector('[data-sidebar-sort-status]')){const status=document.createElement('span');status.className='sr-only';status.dataset.sidebarSortStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');node.append(status);}
  if(pendingOpen&&activeRail()?.dataset.sidebarKey===pendingOpen){pendingOpen=null;if(mobile.matches)setMobileOpen(true,{replace:true});}
  mobileNavigation.refresh();sync();
 }
 function saveOrder(group,ordered){
  const name=group.dataset.sidebarSort;preferences.orders[name]=mergeSidebarOrder(preferences.orders[name],ordered.map(item=>item.dataset.sidebarKey));persist();for(const item of ordered)group.append(item);
 }
 function click(event){
  if(gesture?.started){event.preventDefault();event.stopImmediatePropagation();return;}
  const item=event.target.closest('[data-sidebar-key]');
  if(item&&event.detail!==0&&suppressed&&performance.now()<suppressed.until&&item.dataset.sidebarKey===suppressed.key){event.preventDefault();event.stopImmediatePropagation();suppressed=null;return;}
  if(mobile.matches&&event.target.closest('[data-project],[data-open-shared]'))mobileNavigation.prepareEnter();
  const button=event.target.closest('.workspace-rail .rail-button');if(!button)return;
  if(mobile.matches&&button.dataset.action!=='production'){if(button.classList.contains('active')){event.preventDefault();event.stopImmediatePropagation();mobileNavigation.enter();return;}pendingOpen=null;mobileNavigation.prepareEnter();return;}
  if(mobile.matches&&button.dataset.action==='production')mobileNavigation.prepareEnter();
  if(button.classList.contains('active')){event.preventDefault();event.stopImmediatePropagation();if(mobile.matches)setMobileOpen(true);else{preferences.collapsed=!preferences.collapsed;persist();sync();}return;}
  pendingOpen=button.dataset.sidebarKey;if(!mobile.matches){preferences.collapsed=false;persist();}sync();
 }
 function start(){
  const drag=gesture;if(!drag||!drag.item.isConnected)return;clearTimeout(drag.timer);drag.started=true;
  const rect=drag.item.getBoundingClientRect(),style=getComputedStyle(drag.item);drag.offsetX=drag.x-rect.left;drag.offsetY=drag.y-rect.top;
  drag.preview=drag.item.cloneNode(true);drag.preview.removeAttribute('id');drag.preview.setAttribute('aria-hidden','true');drag.preview.tabIndex=-1;drag.preview.classList.add('sidebar-drag-preview');Object.assign(drag.preview.style,{width:rect.width+'px',height:rect.height+'px',minHeight:rect.height+'px',font:style.font,padding:style.padding});
  drag.line=document.createElement('div');drag.line.className='sidebar-drop-line';drag.line.setAttribute('aria-hidden','true');document.body.append(drag.preview,drag.line);drag.item.classList.add('sidebar-drag-source');document.body.classList.add('is-sidebar-dragging');
  try{drag.item.setPointerCapture(drag.pointerId);}catch{/* Pointer may already have been cancelled by native scrolling. */}
  position(drag.x,drag.y);
 }
 function position(x,y){
  const drag=gesture;if(!drag?.started)return;if(!drag.item.isConnected){finish(false);return;}
  Object.assign(drag.preview.style,{left:x-drag.offsetX+'px',top:y-drag.offsetY+'px'});
  const bounds=drag.group.getBoundingClientRect();drag.valid=x>=bounds.left-16&&x<=bounds.right+16&&y>=bounds.top-18&&y<=bounds.bottom+18;
  drag.line.hidden=!drag.valid;if(!drag.valid)return;
  const horizontal=mobile.matches&&drag.group.classList.contains('workspace-rail');
  if(horizontal&&drag.group.scrollWidth>drag.group.clientWidth){if(x<bounds.left+24)drag.group.scrollLeft-=12;else if(x>bounds.right-24)drag.group.scrollLeft+=12;}
  if(drag.group.scrollHeight>drag.group.clientHeight){if(y<bounds.top+28)drag.group.scrollTop-=12;else if(y>bounds.bottom-28)drag.group.scrollTop+=12;}
  const others=items(drag.group).filter(item=>item!==drag.item);let index=others.findIndex(item=>{const rect=item.getBoundingClientRect();return horizontal?x<rect.left+rect.width/2:y<rect.top+rect.height/2;});if(index<0)index=others.length;drag.index=index;
  const rect=(others[index]||others.at(-1))?.getBoundingClientRect();if(!rect){drag.valid=false;drag.line.hidden=true;return;}
  Object.assign(drag.line.style,horizontal?{left:(others[index]?rect.left-3:rect.right+3)+'px',top:bounds.top+4+'px',width:'2px',height:Math.max(12,bounds.height-8)+'px'}:{left:bounds.left+4+'px',top:(others[index]?rect.top-3:rect.bottom+3)+'px',width:Math.max(12,bounds.width-8)+'px',height:'2px'});
 }
 function finish(commit){
  const drag=gesture;if(!drag)return;gesture=null;clearTimeout(drag.timer);
  if(drag.started){suppressed={key:drag.item.dataset.sidebarKey,until:performance.now()+600};if(commit&&drag.valid&&drag.item.isConnected){const ordered=items(drag.group).filter(item=>item!==drag.item);ordered.splice(drag.index,0,drag.item);saveOrder(drag.group,ordered);drag.item.focus({preventScroll:true});const status=sidebar()?.querySelector('[data-sidebar-sort-status]');if(status)status.textContent=(drag.item.getAttribute('aria-label')||drag.item.textContent.trim())+', '+(drag.index+1)+'번째 위치로 이동했습니다.';}drag.preview?.remove();drag.line?.remove();drag.item.classList.remove('sidebar-drag-source');document.body.classList.remove('is-sidebar-dragging');try{drag.item.releasePointerCapture(drag.pointerId);}catch{}}
 }
 window.addEventListener('click',click,true);
 window.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false)return;suppressed=null;const item=event.target.closest('[data-sidebar-key]'),group=item?.closest('[data-sidebar-sort]');if(!group||item.disabled||items(group).length<2)return;
  finish(false);gesture={item,group,pointerId:event.pointerId,x:event.clientX,y:event.clientY,touch:event.pointerType!=='mouse',started:false};
  if(gesture.touch)gesture.timer=setTimeout(start,320);
 },true);
 window.addEventListener('pointermove',event=>{const drag=gesture;if(!drag||event.pointerId!==drag.pointerId)return;const distance=Math.hypot(event.clientX-drag.x,event.clientY-drag.y);if(!drag.started){if(drag.touch){if(distance>8)finish(false);return;}if(distance<5)return;start();}if(gesture?.started){event.preventDefault();position(event.clientX,event.clientY);}}, {capture:true,passive:false});
 window.addEventListener('touchmove',event=>{if(gesture?.started)event.preventDefault();},{capture:true,passive:false});
 window.addEventListener('pointerup',event=>{if(event.pointerId!==gesture?.pointerId)return;if(gesture.started){event.preventDefault();event.stopImmediatePropagation();}finish(true);},true);
 window.addEventListener('pointercancel',event=>{if(event.pointerId===gesture?.pointerId)finish(false);},true);
 window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();finish(false);return;}
  if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;const item=event.target.closest('[data-sidebar-key]'),group=item?.closest('[data-sidebar-sort]');if(!group)return;event.preventDefault();event.stopImmediatePropagation();const ordered=items(group),index=ordered.indexOf(item),next=index+(event.key==='ArrowUp'?-1:1);if(next<0||next>=ordered.length)return;[ordered[index],ordered[next]]=[ordered[next],ordered[index]];saveOrder(group,ordered);item.focus();
 },true);
 window.addEventListener('contextmenu',event=>{if(gesture?.started){event.preventDefault();event.stopImmediatePropagation();}},true);
 function keyboard(){
  const active=document.activeElement,editing=active?.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]'),height=window.visualViewport?.height||window.innerHeight;
  if(!editing)keyboardBaseline=height;
  const hidden=mobile.matches&&Boolean(editing)&&keyboardBaseline-height>120;
  document.body.classList.toggle('mobile-keyboard-open',hidden);refreshMobileNavigationBackdrop();
  sync();
 }
 window.addEventListener('focusin',keyboard);window.addEventListener('focusout',()=>setTimeout(keyboard,0));window.visualViewport?.addEventListener('resize',keyboard);window.addEventListener('resize',keyboard);
 window.addEventListener('blur',()=>finish(false));mobile.addEventListener('change',()=>{sync();keyboard();});
 const observer=new MutationObserver(()=>{if(gesture&&!gesture.item.isConnected)finish(false);});observer.observe(document.getElementById('app'),{childList:true,subtree:true});
 return {refresh,sync,historyState:mobileNavigation.historyState,focusCurrent:mobileNavigation.focusCurrent};
}
