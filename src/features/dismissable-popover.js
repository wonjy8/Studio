// For disposable menus only; edit dialogs retain their own save/cancel lifecycle.
export function dismissablePopover(node,{close,trigger=document.activeElement,inside=event=>node.contains(event.target)}={}){
 const controller=new AbortController();let ended=false;const stop=()=>{if(ended)return;ended=true;controller.abort();observer.disconnect();};const dismiss=restore=>{if(ended)return;stop();close();if(restore&&trigger?.isConnected)trigger.focus?.({preventScroll:true});};
 const observer=new MutationObserver(()=>{if(!node.isConnected)stop();});observer.observe(document.body,{childList:true,subtree:true});queueMicrotask(()=>{if(!node.isConnected){stop();return;}document.addEventListener('pointerdown',event=>{if(!inside(event))dismiss(false);},{capture:true,signal:controller.signal});document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss(true);}},{capture:true,signal:controller.signal});});return {dispose:stop};
}
