// Keep native scroll geometry and input behavior; only the thumb visibility changes.
export function bindActivityScrollbars(doc=document,{delay=1000}={}){
 const active=new Map(),view=doc.defaultView;
 const clear=element=>{view.clearTimeout(active.get(element));active.delete(element);element.removeAttribute('data-scroll-active');};
 const show=event=>{const element=event.target===doc?doc.scrollingElement:event.target;if(!element?.setAttribute)return;view.clearTimeout(active.get(element));element.setAttribute('data-scroll-active','');active.set(element,view.setTimeout(()=>clear(element),delay));};
 const reset=()=>{for(const element of active.keys())clear(element);};
 doc.addEventListener('scroll',show,{capture:true,passive:true});view.addEventListener('pagehide',reset);
 return ()=>{reset();doc.removeEventListener('scroll',show,true);view.removeEventListener('pagehide',reset);};
}
if(typeof document!=='undefined')bindActivityScrollbars();
