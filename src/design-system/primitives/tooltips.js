// Delegation survives editor redraws; the caller owns the lifecycle signal.
export function bindTooltips(root,{signal}={}){
 if(signal?.aborted)return;
 const controller=new AbortController(),listenerSignal=controller.signal;
 let trigger=null,tip=null,timer=null;
 const hide=()=>{
  clearTimeout(timer);
  if(trigger&&tip){const ids=(trigger.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)trigger.setAttribute('aria-describedby',ids.join(' '));else trigger.removeAttribute('aria-describedby');}
  tip?.remove();tip=null;trigger=null;
 };
 const show=button=>{
  if(!button||button.disabled||trigger===button)return;
  hide();trigger=button;tip=document.createElement('div');tip.className='control-tooltip';tip.id='control-tooltip-'+crypto.randomUUID();tip.setAttribute('role','tooltip');tip.textContent=button.dataset.tooltip;
  document.body.append(tip);button.setAttribute('aria-describedby',[button.getAttribute('aria-describedby'),tip.id].filter(Boolean).join(' '));
  const r=button.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left+(r.width-t.width)/2,innerWidth-t.width-8))+'px';tip.style.top=(r.bottom+t.height+8<=innerHeight?r.bottom+6:Math.max(8,r.top-t.height-6))+'px';
  tip.addEventListener('pointerenter',()=>clearTimeout(timer));tip.addEventListener('pointerleave',()=>{if(document.activeElement!==trigger)hide();});
 };
 const options={signal:listenerSignal};
 root.addEventListener('focusin',event=>show(event.target.closest('[data-tooltip]')),options);
 root.addEventListener('focusout',hide,options);
 root.addEventListener('pointerover',event=>show(event.target.closest('[data-tooltip]')),options);
 root.addEventListener('pointerout',event=>{if(trigger&&!trigger.contains(event.relatedTarget)&&!tip?.contains(event.relatedTarget)&&document.activeElement!==trigger)timer=setTimeout(hide,100);},options);
 root.addEventListener('click',hide,options);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},options);
 window.addEventListener('scroll',hide,{capture:true,passive:true,signal:listenerSignal});window.addEventListener('resize',hide,options);
 const dispose=()=>{hide();observer.disconnect();controller.abort();signal?.removeEventListener('abort',dispose);};
 const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();else if(trigger&&!trigger.isConnected)hide();});observer.observe(document.body,{childList:true,subtree:true});
 signal?.addEventListener('abort',dispose,{once:true});
 return dispose;
}
