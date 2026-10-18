let cleanupPicker;
// One active sidebar picker; replacing sidebar metadata also removes old document listeners.
export function bindInventoryCollectionPicker({onSelect=()=>{},onAdd=()=>{}}={}){
 cleanupPicker?.();const root=document.querySelector('[data-inventory-collection-picker]');if(!root)return;
 const trigger=root.querySelector('[data-inventory-picker-toggle]'),menu=root.querySelector('[data-inventory-picker-menu]'),controller=new AbortController(),options=[...menu.querySelectorAll('[role=menuitemradio],[role=menuitem]')];let open=false;
 const close=(restore=false)=>{open=false;menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore&&trigger.isConnected)trigger.focus();};
 const show=(edge)=>{open=true;menu.hidden=false;trigger.setAttribute('aria-expanded','true');const option=edge==='last'?options.at(-1):edge==='first'?options[0]:options.find(option=>option.getAttribute('aria-checked')==='true')||options[0];option?.focus();};
 const cleanup=()=>{controller.abort();close();};cleanupPicker=cleanup;
 trigger.addEventListener('click',event=>{event.stopImmediatePropagation();open?close(true):show();},{signal:controller.signal});
 trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();show(event.key==='ArrowUp'||event.key==='End'?'last':'first');}},{signal:controller.signal});
 menu.addEventListener('keydown',event=>{const index=options.indexOf(document.activeElement);let next;if(event.key==='ArrowDown')next=(index+1)%options.length;else if(event.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}else if(event.key==='Tab'){close();return;}else return;event.preventDefault();event.stopPropagation();options[next]?.focus();},{signal:controller.signal});
 options.forEach(option=>option.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();close(true);if(option.hasAttribute('data-add-inventory-organization'))onAdd();else onSelect(option.dataset.inventoryCollection);},{signal:controller.signal}));
 document.addEventListener('pointerdown',event=>{if(!root.isConnected){cleanup();return;}if(open&&!root.contains(event.target))close();},{capture:true,signal:controller.signal});
 document.addEventListener('focusin',event=>{if(open&&!root.contains(event.target))close();},{signal:controller.signal});
 return cleanup;
}
