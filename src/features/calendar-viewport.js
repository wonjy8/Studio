// Size the month surface from its actual position, rather than a fixed week height.
export function bindCalendarViewport(root){
 let frame;
 const signal=new AbortController();
 function measure(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   if(!root.isConnected)return;
   const month=root.querySelector('.month-calendar');
   if(!month)return;
   const viewport=window.visualViewport;
   let bottom=viewport?viewport.height+viewport.offsetTop:innerHeight;
   for(const navigation of document.querySelectorAll('.mobile-workspace-navigation,.workspace-rail')){
    const style=getComputedStyle(navigation),rect=navigation.getBoundingClientRect();
    if(style.position==='fixed'&&rect.width&&rect.height&&rect.top>0)bottom=Math.min(bottom,rect.top);
   }
   const weeks=Number(month.style.getPropertyValue('--calendar-weeks'))||6;
   const height=Math.max(28+weeks*48,bottom-month.getBoundingClientRect().top-16);
   month.style.setProperty('--calendar-month-height',height+'px');
   month.querySelectorAll('.calendar-cell-events').forEach(cell=>{
    cell.tabIndex=0;
    cell.setAttribute('role','region');
    cell.setAttribute('aria-label',cell.closest('.month-cell').querySelector('[data-workspace-day]')?.getAttribute('aria-label')+' 일정');
   });
  });
 }
 window.addEventListener('resize',measure,{signal:signal.signal});
 window.visualViewport?.addEventListener('resize',measure,{signal:signal.signal});
 const resize=new ResizeObserver(measure);resize.observe(root);
 const changes=new MutationObserver(measure);changes.observe(root,{childList:true,subtree:true});
 const lifetime=new MutationObserver(()=>{if(!root.isConnected){signal.abort();resize.disconnect();changes.disconnect();lifetime.disconnect();cancelAnimationFrame(frame);}});
 lifetime.observe(document.body,{childList:true,subtree:true});
 measure();
}
