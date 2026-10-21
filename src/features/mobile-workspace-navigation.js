import {navigationIcon as icon} from '../design-system/primitives/icons.js';
// Mobile chrome projects existing authorized destinations; their original handlers
// still own navigation, draft guards and permissions. No editor DOM is replaced.
export function createMobileWorkspaceNavigation({sidebar,mobile,setMobileOpen}){
 let level=history.state?.mobileNavigationLevel||(/^\/(?:login|signin|signup|index\.html)?$/.test(location.pathname)?'root':'children'),pending=false,pendingTimer=null,targets=new WeakMap();
 const rootRail=()=>sidebar()?.querySelector('.workspace-rail');
 const chrome=()=>sidebar()?.querySelector('[data-mobile-workspace-navigation]');
 function prepareEnter(){pending=true;clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{pending=false;},0);}
 function historyState(){return {mobileNavigationLevel:pending?'children':level};}
 function focusCurrent(){const node=sidebar();if(!node)return;const target=mobile.matches&&chrome()&&!chrome().hidden?node.querySelector('[data-mobile-workspace-navigation] [aria-current=page], [data-mobile-workspace-navigation] [data-mobile-more]')||node.querySelector('[data-mobile-destination]'):node.querySelector('.workspace-rail .rail-button.active');target?.focus({preventScroll:true});}
 function setLevel(next,{record=true}={}){level=next;if(record){const {mobileNavigation,...state}=history.state||{};history.pushState({...state,...historyState()},'',location.href);}sync();}
 function refresh(){
  const node=sidebar();if(!node)return;const entering=pending;if(pending){level='children';pending=false;}
  const focused=document.activeElement?.closest('[data-mobile-workspace-navigation]')?{destination:document.activeElement.dataset.mobileDestination,back:document.activeElement.hasAttribute('data-mobile-nav-back'),more:document.activeElement.hasAttribute('data-mobile-more')}:null;
  node.querySelector('[data-mobile-workspace-navigation]')?.remove();targets=new WeakMap();
  const production=Boolean(rootRail()?.querySelector('[data-action=production].active'));
  const source=production?document.querySelector('.project-tabs'):node.querySelector('.project-sidebar nav.project-list');
  const entries=[...(source?.querySelectorAll(':scope > button')||[])];if(!entries.length)return;
  const wrap=document.createElement('div');wrap.className='mobile-workspace-navigation';wrap.dataset.mobileWorkspaceNavigation='';
  const back=document.createElement('button');back.type='button';back.className='mobile-workspace-back';back.dataset.mobileNavBack='';back.title='워크스페이스 선택';back.setAttribute('aria-label','워크스페이스 선택으로 돌아가기');back.innerHTML=icon('arrow');
  const pill=document.createElement('nav');pill.className='mobile-workspace-pill';pill.setAttribute('aria-label',(node.querySelector('.sidebar-heading h2')?.textContent||'프로젝트')+' 하위 메뉴');
  const settings=Boolean(rootRail()?.querySelector('[data-view=settings].active')),visible=settings?entries.filter(button=>button.dataset.settingsSection):entries;
  for(const original of visible){const button=document.createElement('button');button.type='button';button.className='mobile-workspace-tab';button.dataset.mobileDestination=original.dataset.settingsSection||original.dataset.view;const name=original.textContent.trim();button.title=name;button.setAttribute('aria-label',name);const svg=original.querySelector('svg');if(svg)button.append(svg.cloneNode(true));if(original.getAttribute('aria-current')==='page'){button.setAttribute('aria-current','page');button.classList.add('active');}targets.set(button,original);pill.append(button);}
  if(settings&&entries.length>visible.length){const more=document.createElement('button');more.type='button';more.className='mobile-workspace-tab';more.dataset.mobileMore='';more.title='설정 더 보기';more.setAttribute('aria-label','설정 더 보기');more.setAttribute('aria-controls','workspace-secondary-sidebar');more.innerHTML=icon('menu');if(!visible.some(button=>button.getAttribute('aria-current')==='page')){more.classList.add('active');more.setAttribute('aria-current','page');}pill.append(more);}
  wrap.append(back,pill);node.append(wrap);sync();if(entering&&mobile.matches&&!node.classList.contains('is-open'))focusCurrent();if(focused){const button=focused.back?back:focused.more?wrap.querySelector('[data-mobile-more]'):[...pill.querySelectorAll('[data-mobile-destination]')].find(button=>button.dataset.mobileDestination===focused.destination);button?.focus({preventScroll:true});}
 }
 function sync(){
  const node=sidebar(),rail=rootRail(),wrap=chrome();if(!node||!rail)return;
  const productionList=node.classList.contains('is-open')&&Boolean(rail.querySelector('[data-action=production].active'));
  const children=mobile.matches&&level==='children'&&Boolean(wrap)&&!productionList,blocked=mobile.matches&&(document.body.classList.contains('mobile-keyboard-open')||Boolean(document.querySelector('.modal-wrap,dialog[open]')));
  rail.hidden=children;rail.inert=children||blocked;rail.setAttribute('aria-hidden',String(children||blocked));
  if(wrap){wrap.hidden=!children;wrap.inert=!children||blocked;wrap.setAttribute('aria-hidden',String(!children||blocked));wrap.querySelector('[data-mobile-more]')?.setAttribute('aria-expanded',String(node.classList.contains('is-open')));const selected=wrap.querySelector('[aria-current=page]');if(children&&selected){const pill=selected.parentElement,left=selected.offsetLeft,right=left+selected.offsetWidth;if(left<pill.scrollLeft)pill.scrollLeft=left;else if(right>pill.scrollLeft+pill.clientWidth)pill.scrollLeft=right-pill.clientWidth;}}
 }
 function click(event){
  const target=event.target.closest('[data-mobile-nav-back],[data-mobile-more],[data-mobile-destination]');if(!target||!mobile.matches)return;event.preventDefault();event.stopImmediatePropagation();
  if(target.hasAttribute('data-mobile-nav-back')){if(sidebar()?.classList.contains('is-open'))setMobileOpen(false,{record:false});setLevel('root');rootRail()?.querySelector('.active')?.focus({preventScroll:true});}
  else if(target.hasAttribute('data-mobile-more'))setMobileOpen(!sidebar()?.classList.contains('is-open'));
  else{targets.get(target)?.click();focusCurrent();}
 }
 window.addEventListener('click',click,true);
 window.addEventListener('popstate',()=>{level=history.state?.mobileNavigationLevel||'children';pending=false;sync();});
 return {refresh,sync,prepareEnter,historyState,focusCurrent,enter:()=>{setLevel('children');focusCurrent();}};
}
