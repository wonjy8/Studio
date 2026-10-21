// Bottom-tab gestures preview locally, then replay exactly one existing click.
export function createMobileNavigationMotion({sidebar,mobile}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Map();
 let previous=null,pending=null,drag=null,suppressedUntil=0;
 const scope='.workspace-rail,.mobile-workspace-pill';
 const buttons=nav=>[...nav.querySelectorAll(':scope > button')];
 const selectable=button=>button&&!button.disabled&&!button.closest('[inert]')&&!button.hasAttribute('data-mobile-more')&&Boolean(button.matches('.rail-button,[data-mobile-destination]'));
 const navFor=button=>button?.closest(scope);
 const group=nav=>nav.classList.contains('workspace-rail')?'root':nav.getAttribute('aria-label');
 const visible=nav=>nav&&nav.isConnected&&nav.getClientRects().length>0&&!nav.closest('[inert]');
 const box=(button,nav)=>{const b=button.getBoundingClientRect(),n=nav.getBoundingClientRect();return {x:b.left-n.left+nav.scrollLeft-nav.clientLeft,y:b.top-n.top+nav.scrollTop-nav.clientTop,width:b.width,height:b.height};};
 const active=nav=>buttons(nav).find(button=>button.matches('.active,[aria-current=page]'));
 function animate(key,node,frames,duration=170){animations.get(key)?.cancel();animations.delete(key);if(reduced.matches||!node?.animate)return;const animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});animations.set(key,animation);animation.onfinish=()=>{if(animations.get(key)===animation)animations.delete(key);};}
 function marker(nav){let node=nav.querySelector(':scope > [data-mobile-nav-indicator]');if(!node){node=document.createElement('span');node.dataset.mobileNavIndicator='';node.setAttribute('aria-hidden','true');node.inert=true;nav.append(node);nav.dataset.mobileMotion='';}return node;}
 function place(nav,button,{from=null,motion=false}={}){const node=marker(nav);node.hidden=!button;if(!button)return;const next=box(button,nav),old=from||next;const frames=[{transform:`translate(${old.x}px,${old.y}px)`,width:old.width+'px',height:old.height+'px'},{transform:`translate(${next.x}px,${next.y}px)`,width:next.width+'px',height:next.height+'px'}];Object.assign(node.style,frames[1]);if(motion)animate('indicator',node,frames);return next;}
 function refresh(){
  if(drag&&!drag.source.isConnected)finish(false);
  if(!mobile.matches){for(const animation of animations.values())animation.cancel();animations.clear();previous=null;pending=null;return;}
  const nav=[...(sidebar()?.querySelectorAll(scope)||[])].find(visible);if(!nav)return;
  const selected=active(nav),key=selected?.dataset.mobileDestination||selected?.dataset.sidebarKey||selected?.dataset.mobileMore!==undefined&&'more',currentGroup=group(nav),changed=previous&&(previous.group!==currentGroup||previous.key!==key);
  const currentBox=place(nav,selected,{from:previous?.group===currentGroup?previous.box:null,motion:Boolean(changed&&previous?.group===currentGroup)});
  if(changed&&previous.group!==currentGroup){for(const [index,svg]of [...nav.querySelectorAll('button .icon')].entries())animate('enter-'+index,svg,[{opacity:0,transform:'translateY(3px) scale(.96)'},{opacity:1,transform:'none'}],160);}
  else if(changed&&selected)animate('icon',selected.querySelector('.icon'),[{transform:'translateY(1px) scale(.94)'},{transform:'translateY(-2px) scale(1.04)',offset:.55},{transform:'none'}]);
  previous={group:currentGroup,key,box:currentBox};
  if(pending&&performance.now()-pending.at>2500)pending=null;
  if(pending){const content=document.querySelector('.main > .content');if(content&&content!==pending.content&&location.href!==pending.url){animate('page',content.querySelector(':scope > .save-content')||content,[{opacity:.8,transform:`translateX(${pending.direction*18}px)`},{opacity:1,transform:'none'}]);pending=null;}}
 }
 function beforeActivate(button){if(!mobile.matches)return;const nav=navFor(button);if(!visible(nav))return;const entries=buttons(nav),from=entries.indexOf(active(nav)),to=entries.indexOf(button),direction=Math.sign(to-from);pending=direction&&from>=0?{direction,at:performance.now(),url:location.href,content:document.querySelector('.main > .content')}:null;}
 function preview(button){const gesture=drag;if(!gesture||gesture.target===button)return;animations.get('indicator')?.cancel();animations.delete('indicator');gesture.target?.classList.remove('is-mobile-nav-preview');gesture.target=button;button?.classList.add('is-mobile-nav-preview');place(gesture.nav,button||active(gesture.nav),{motion:false});}
 function hit(x,y){const button=document.elementFromPoint(x,y)?.closest('button');return selectable(button)&&navFor(button)===drag?.nav?button:null;}
 function scrollPreview(){if(!drag?.started)return;const n=drag.nav,r=n.getBoundingClientRect(),delta=drag.x>r.right-22?4:drag.x<r.left+22?-4:0;if(delta)n.scrollLeft+=delta;preview(hit(drag.x,drag.y));drag.frame=requestAnimationFrame(scrollPreview);}
 function finish(commit,event){const gesture=drag;if(!gesture)return;drag=null;cancelAnimationFrame(gesture.frame);gesture.target?.classList.remove('is-mobile-nav-preview');delete gesture.nav.dataset.mobileDragging;
  if(gesture.started){suppressedUntil=performance.now()+600;event?.preventDefault();event?.stopImmediatePropagation();}
  try{if(gesture.source.hasPointerCapture(gesture.id))gesture.source.releasePointerCapture(gesture.id);}catch{/* Pointer already cancelled or DOM replaced. */}
  place(gesture.nav,active(gesture.nav));
  if(commit&&gesture.started&&gesture.target?.isConnected&&gesture.target!==active(gesture.nav)&&selectable(gesture.target))gesture.target.click();
 }
 window.addEventListener('click',event=>{const button=event.target.closest('button'),nav=navFor(button);if(!nav||!mobile.matches)return;if(event.detail!==0&&performance.now()<suppressedUntil){event.preventDefault();event.stopImmediatePropagation();suppressedUntil=0;return;}if(selectable(button))beforeActivate(button);},true);
 window.addEventListener('pointerdown',event=>{
  if(!mobile.matches)return;if(event.isPrimary===false){finish(false);return;}if(event.button!==0)return;
  const source=event.target.closest('button'),nav=navFor(source);if(!selectable(source)||!visible(nav)||event.clientX<20||event.clientX>innerWidth-20)return;
  finish(false);suppressedUntil=0;drag={source,nav,id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,started:false,target:null,frame:0};
 },true);
 window.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;drag.x=event.clientX;drag.y=event.clientY;const dx=Math.abs(drag.x-drag.startX),dy=Math.abs(drag.y-drag.startY);
  if(!drag.started){if(dy>8&&dy>=dx){suppressedUntil=performance.now()+600;finish(false);return;}if(dx<10||dx<dy*1.25)return;drag.started=true;drag.nav.dataset.mobileDragging='';try{drag.source.setPointerCapture(drag.id);}catch{}scrollPreview();}
  event.preventDefault();preview(hit(drag.x,drag.y));
 },{capture:true,passive:false});
 window.addEventListener('pointerup',event=>{if(event.pointerId!==drag?.id)return;if(drag.started)preview(hit(event.clientX,event.clientY));finish(true,event);},true);
 window.addEventListener('pointercancel',event=>{if(event.pointerId===drag?.id)finish(false);},true);
 window.addEventListener('lostpointercapture',event=>{if(event.pointerId===drag?.id&&event.target===drag.source&&!drag.source.hasPointerCapture(drag.id))finish(false);},true);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag?.started){event.preventDefault();event.stopImmediatePropagation();finish(false);}},true);
 window.addEventListener('blur',()=>finish(false));window.addEventListener('popstate',()=>{finish(false);pending=null;});
 mobile.addEventListener('change',()=>{finish(false);refresh();});reduced.addEventListener('change',()=>{for(const animation of animations.values())animation.cancel();animations.clear();pending=null;});
 return {refresh};
}
