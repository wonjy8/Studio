// Native per-pane scrolling with viewport bounds; no wheel or keyboard cancellation.
export function bindSplitPaneScroll(split,{reserve=24}={}){
 const desktop=matchMedia('(min-width:901px)');let frame=0,disposed=false;split.dataset.independentSplit='';
 const bodyState=()=>document.body.classList.toggle('scripture-independent-scroll',desktop.matches&&Boolean(document.querySelector('[data-independent-split]:not(.is-scripture-hidden)')));
 function layout(){if(disposed)return;if(!split.isConnected){dispose();return;}const enabled=desktop.matches&&!split.classList.contains('is-scripture-hidden');if(enabled){const height=Math.max(80,innerHeight-split.getBoundingClientRect().top-reserve),value=height+'px';if(split.style.height!==value)split.style.height=value;for(const pane of split.children){pane.tabIndex=0;pane.dataset.splitPane='';}}else{split.style.height='';for(const pane of split.children){pane.removeAttribute('tabindex');delete pane.dataset.splitPane;}}bodyState();}
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
 const size=new ResizeObserver(schedule);size.observe(split.parentElement);const lifetime=new MutationObserver(()=>{if(!split.isConnected)dispose();});lifetime.observe(document.body,{childList:true,subtree:true});const changes=new MutationObserver(schedule);changes.observe(split,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',schedule);desktop.addEventListener('change',schedule);
 function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);size.disconnect();changes.disconnect();lifetime.disconnect();window.removeEventListener('resize',schedule);desktop.removeEventListener('change',schedule);split.removeAttribute('data-independent-split');bodyState();}
 schedule();return {refresh:schedule,dispose};
}
