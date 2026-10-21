// A body-level backdrop avoids app clipping/stacking roots and overscans the
// browser's changing viewport edge. It never controls native Safari surfaces.
let layer=null,frame=0,observedRail=null,observer=null,installed=false;
export function refreshMobileNavigationBackdrop(){
 if(!installed){installed=true;window.addEventListener('resize',schedule,{passive:true});window.addEventListener('scroll',schedule,{passive:true});window.visualViewport?.addEventListener('resize',schedule,{passive:true});window.visualViewport?.addEventListener('scroll',schedule,{passive:true});}
 schedule();
}
function schedule(){if(frame)return;frame=requestAnimationFrame(update);}
function update(){
 frame=0;const rail=document.querySelector('.production-app .workspace-rail'),mobile=matchMedia('(max-width:900px)').matches;
 if(!layer?.isConnected){layer=document.createElement('div');layer.className='mobile-navigation-backdrop';layer.dataset.mobileNavigationBackdrop='';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);}
 layer.hidden=!mobile||!rail;
 if(rail!==observedRail){observer?.disconnect();observedRail=rail;if(rail){observer=new ResizeObserver(schedule);observer.observe(rail);}}
 if(layer.hidden)return;
 const box=rail.getBoundingClientRect(),viewport=window.visualViewport,visibleBottom=(viewport?.offsetTop||0)+(viewport?.height||window.innerHeight),extra=Math.max(0,window.innerHeight-visibleBottom);
 layer.style.setProperty('--mobile-backdrop-top',Math.max(0,box.top-32)+'px');layer.style.setProperty('--mobile-backdrop-extra',Math.ceil(extra)+'px');
}
