import {createMobileNavigationMotion} from './mobile-navigation-motion.js';
import {navigationIcon as icon} from '../design-system/primitives/icons.js';
// Mobile chrome projects existing authorized destinations; their original handlers
// still own navigation, draft guards and permissions, including Home-directed Back.
export function createMobileWorkspaceNavigation({sidebar,mobile,setMobileOpen,onHome}){
 let level=history.state?.mobileNavigationLevel||(/^\/(?:login|signin|signup|index\.html)?$/.test(location.pathname)?'root':'children'),pending=false,pendingLevel='children',pendingTimer=null,targets=new WeakMap();
 const motion=createMobileNavigationMotion({sidebar,mobile});
 const rootRail=()=>sidebar()?.querySelector('.workspace-rail');
 const chrome=()=>sidebar()?.querySelector('[data-mobile-workspace-navigation]');
 function prepareEnter(next='children'){pendingLevel=next;pending=true;clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{pending=false;},0);}
 function historyState(){return {mobileNavigationLevel:pending?pendingLevel:level};}
 function focusCurrent(){const node=sidebar();if(!node)return;const target=mobile.matches&&chrome()&&!chrome().hidden?node.querySelector('[data-mobile-workspace-navigation] [aria-current=page], [data-mobile-workspace-navigation] [data-mobile-admin]')||node.querySelector('[data-mobile-destination]'):node.querySelector('.workspace-rail .rail-button.active');target?.focus({preventScroll:true});}
 function setLevel(next,{record=true}={}){level=next;if(record){const {mobileNavigation,...state}=history.state||{};history.pushState({...state,...historyState()},'',location.href);}sync();}
 function refresh(){
  const node=sidebar();if(!node)return;const entering=pending;if(pending){level=pendingLevel;pending=false;if(level==='root'&&history.state?.mobileNavigationLevel!=='root')history.replaceState({...history.state,mobileNavigationLevel:'root'},'',location.href);}
  const focused=document.activeElement?.closest('[data-mobile-workspace-navigation]')?{destination:document.activeElement.dataset.mobileDestination,back:document.activeElement.hasAttribute('data-mobile-nav-back'),more:document.activeElement.hasAttribute('data-mobile-admin')}:null;
  node.querySelector('[data-mobile-workspace-navigation]')?.remove();targets=new WeakMap();
  const production=Boolean(rootRail()?.querySelector('[data-action=production].active'));
  const source=production?document.querySelector('.project-tabs'):node.querySelector('.project-sidebar nav.project-list');
  const entries=[...(source?.querySelectorAll(':scope > button')||[])];if(!entries.length)return;
  const wrap=document.createElement('div');wrap.className='mobile-workspace-navigation';wrap.dataset.mobileWorkspaceNavigation='';
  const back=document.createElement('button');back.type='button';back.className='mobile-workspace-back back-navigation';back.dataset.mobileNavBack='';back.dataset.view='workspace-home';back.onclick=onHome;back.title='홈으로';back.setAttribute('aria-label','홈으로 돌아가기');back.innerHTML=icon('chevron');
  const pill=document.createElement('nav');pill.className='mobile-workspace-pill';pill.setAttribute('aria-label',(node.querySelector('.sidebar-heading h2')?.textContent||'프로젝트')+' 하위 메뉴');
  const settings=Boolean(rootRail()?.querySelector('[data-view=settings].active')),home=Boolean(rootRail()?.querySelector('[data-view=workspace-home].active')),visible=settings?entries.filter(button=>button.dataset.settingsSection):home?entries.filter(button=>button.dataset.view==='workspace-home'):entries;if(home)pill.dataset.singleTab='';
  for(const original of visible){const button=document.createElement('button');button.type='button';button.className='mobile-workspace-tab';button.dataset.mobileDestination=original.dataset.settingsSection||original.dataset.view;const name=home?'홈':original.textContent.trim();button.title=name;button.setAttribute('aria-label',name);const svg=original.querySelector('svg');if(home)button.innerHTML=icon('home',{solid:true});else if(svg)button.append(svg.cloneNode(true));if(home||original.getAttribute('aria-current')==='page'){button.setAttribute('aria-current','page');button.classList.add('active');}targets.set(button,original);pill.append(button);}
  if(settings&&entries.length>visible.length){const more=document.createElement('button');more.type='button';more.className='mobile-workspace-tab';more.dataset.mobileAdmin='';more.title='관리자';more.setAttribute('aria-label','관리자');more.setAttribute('aria-controls','workspace-secondary-sidebar');more.innerHTML=icon('shield',{solid:!visible.some(button=>button.getAttribute('aria-current')==='page')});if(!visible.some(button=>button.getAttribute('aria-current')==='page')){more.classList.add('active');more.setAttribute('aria-current','page');}pill.append(more);}
  wrap.append(back,pill);node.append(wrap);sync();if(entering&&mobile.matches&&!node.classList.contains('is-open'))focusCurrent();if(focused){const button=focused.back?back:focused.more?wrap.querySelector('[data-mobile-admin]'):[...pill.querySelectorAll('[data-mobile-destination]')].find(button=>button.dataset.mobileDestination===focused.destination);button?.focus({preventScroll:true});}
 }
 function sync(){
  const node=sidebar(),rail=rootRail(),wrap=chrome();if(!node||!rail)return;
  const productionList=node.classList.contains('is-open')&&Boolean(rail.querySelector('[data-action=production].active'));
  const children=mobile.matches&&level==='children'&&Boolean(wrap)&&!productionList,blocked=mobile.matches&&(document.body.classList.contains('mobile-keyboard-open')||Boolean(document.querySelector('.modal-wrap,dialog[open]')));
  rail.hidden=children;rail.inert=children||blocked;rail.setAttribute('aria-hidden',String(children||blocked));
  if(wrap){wrap.hidden=!children;wrap.inert=!children||blocked;wrap.setAttribute('aria-hidden',String(!children||blocked));wrap.querySelector('[data-mobile-admin]')?.setAttribute('aria-expanded',String(node.classList.contains('is-open')));const selected=wrap.querySelector('[aria-current=page]');if(children&&selected){const pill=selected.parentElement,left=selected.offsetLeft,right=left+selected.offsetWidth;if(left<pill.scrollLeft)pill.scrollLeft=left;else if(right>pill.scrollLeft+pill.clientWidth)pill.scrollLeft=right-pill.clientWidth;}}
  const adminList=mobile.matches&&node.classList.contains('is-open')&&Boolean(rail.querySelector('[data-view=settings].active'))&&Boolean(wrap?.querySelector('[data-mobile-admin]'));node.toggleAttribute('data-mobile-admin-settings',adminList);if(wrap?.querySelector('[data-mobile-admin]')){let ordinarySelected=false;for(const button of wrap.querySelectorAll('[data-mobile-destination]')){const selected=!adminList&&targets.get(button)?.getAttribute('aria-current')==='page';button.classList.toggle('active',selected);if(selected){button.setAttribute('aria-current','page');ordinarySelected=true;}else button.removeAttribute('aria-current');}const admin=wrap.querySelector('[data-mobile-admin]');admin.classList.toggle('active',!ordinarySelected);if(!ordinarySelected)admin.setAttribute('aria-current','page');else admin.removeAttribute('aria-current');}if(rail.querySelector('[data-view=settings].active'))node.querySelector('.sidebar-heading h2').textContent=adminList?'관리자':'설정';
  motion.refresh();
 }
 function click(event){
  const target=event.target.closest('[data-mobile-nav-back],[data-mobile-admin],[data-mobile-destination]');if(!target||!mobile.matches)return;if(target.hasAttribute('data-mobile-nav-back')){prepareEnter('root');return;}event.preventDefault();event.stopImmediatePropagation();
  if(target.dataset.mobileDestination==='school-semesters'&&target.getAttribute('aria-current')==='page'){setMobileOpen(!sidebar()?.classList.contains('is-open'));return;}
  if(target.hasAttribute('data-mobile-admin'))setMobileOpen(!sidebar()?.classList.contains('is-open'));
  else{targets.get(target)?.click();focusCurrent();}
 }
 window.addEventListener('click',click,true);
 window.addEventListener('popstate',()=>{level=history.state?.mobileNavigationLevel||'children';pending=false;sync();});
 return {refresh,sync,prepareEnter,prepareHome:()=>prepareEnter('root'),historyState,focusCurrent,enter:()=>{setLevel('children');focusCurrent();}};
}
