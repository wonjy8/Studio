import {icon} from '../design-system/primitives/icons.js';

let activeMenu=null;
const edge=8;

function editableTarget(target){
  return target?.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea,[contenteditable="true"]')||null;
}
function selectedText(target){
  if(target instanceof HTMLInputElement&&target.type==='password')return '';
  if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement){
    try{return target.value.slice(target.selectionStart,target.selectionEnd);}catch{return '';}
  }
  return window.getSelection?.().toString()||'';
}
function place(menu,x,y){
  menu.style.left='0px';menu.style.top='0px';
  const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(edge,Math.min(x,innerWidth-rect.width-edge))+'px';
  menu.style.top=Math.max(edge,Math.min(y,innerHeight-rect.height-edge))+'px';
}
function closeMenu(restore=false){
  if(!activeMenu)return;
  const {element,origin}=activeMenu;
  activeMenu=null;element.remove();
  if(restore&&origin?.isConnected)origin.focus({preventScroll:true});
}
async function writeClipboard(value,target){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(value);return true;}catch{}
  }
  target?.focus?.({preventScroll:true});
  return document.execCommand('copy');
}
function fireInput(target,text){
  target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));
}
async function runAction(action,target,menu){
  if(action==='copy'){
    await writeClipboard(selectedText(target),target);
  }else if(action==='copy-link'){
    await writeClipboard(target.closest('a[href]')?.href||'',target);
  }else if(action==='copy-image'){
    await writeClipboard(target.closest('img')?.currentSrc||target.closest('img')?.src||'',target);
  }else if(action==='cut'){
    if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement){
      const start=target.selectionStart,end=target.selectionEnd,value=target.value.slice(start,end);
      if(await writeClipboard(value,target)){target.setRangeText('',start,end,'start');fireInput(target,'');}
    }else{
      target.focus?.({preventScroll:true});
      if(!document.execCommand('cut'))await writeClipboard(selectedText(target),target);
    }
  }else if(action==='paste'){
    try{
      const value=await navigator.clipboard.readText();
      target.focus?.({preventScroll:true});
      if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement){
        const start=target.selectionStart??target.value.length,end=target.selectionEnd??start;
        target.setRangeText(value,start,end,'end');fireInput(target,value);
      }else{
        document.execCommand('insertText',false,value);
      }
      closeMenu();
    }catch{
      const status=menu.querySelector('[data-menu-status]');
      if(status)status.textContent='클립보드 권한을 확인하거나 키보드 붙여넣기를 사용하세요.';
    }
    return;
  }else if(action==='select-all'){
    if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)target.select();
    else{
      const root=document.querySelector('.production-app')||document.body;
      const selection=window.getSelection();
      selection?.selectAllChildren(root);
    }
  }else if(action==='reload'){
    location.reload();
  }else if(action==='top'){
    window.scrollTo({top:0,behavior:'smooth'});
  }else if(action==='bottom'){
    window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});
  }
  closeMenu();
}
function makeMenuItem(menu,item,target){
  if(item.separator){const rule=document.createElement('div');rule.className='app-context-menu-rule';rule.setAttribute('role','separator');menu.append(rule);return;}
  const button=document.createElement('button');
  button.type='button';button.setAttribute('role','menuitem');button.tabIndex=-1;
  button.disabled=Boolean(item.disabled);
  button.innerHTML=icon(item.icon);
  const label=document.createElement('span');label.textContent=item.label;button.append(label);
  button.addEventListener('click',()=>void runAction(item.action,target,menu));
  menu.append(button);
}
function openMenu(event,target,items){
  closeMenu();
  const menu=document.createElement('div');
  menu.className='app-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Studio 메뉴');
  for(const item of items)makeMenuItem(menu,item,target);
  const status=document.createElement('div');status.className='app-context-menu-status';status.dataset.menuStatus='';status.setAttribute('role','status');menu.append(status);
  document.body.append(menu);
  let x=event.clientX,y=event.clientY;
  if(!x&&!y){const rect=target.getBoundingClientRect();x=rect.left+Math.min(rect.width/2,24);y=rect.top+Math.min(rect.height/2,24);}
  place(menu,x,y);
  activeMenu={element:menu,origin:document.activeElement};
  menu.addEventListener('keydown',e=>{
    const buttons=[...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const current=buttons.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu(true);}
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();e.stopPropagation();
      const offset=e.key==='ArrowDown'?1:-1;
      buttons[(current+offset+buttons.length)%buttons.length]?.focus();
    }else if(e.key==='Home'){e.preventDefault();buttons[0]?.focus();}
    else if(e.key==='End'){e.preventDefault();buttons.at(-1)?.focus();}
  });
  menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus({preventScroll:true});
}
function handleContextMenu(event){
  if(event.defaultPrevented)return;
  const target=event.target instanceof Element?event.target:null;
  if(!target?.closest('.production-app'))return;
  const editable=editableTarget(target),text=selectedText(target),items=[];
  if(editable&&text)items.push({label:'잘라내기',icon:'tabler-scissors',action:'cut'});
  if(text)items.push({label:'복사',icon:'tabler-copy',action:'copy'});
  const link=target.closest('a[href]'),imageTarget=target.closest('img');
  if(link)items.push({label:'링크 주소 복사',icon:'tabler-link',action:'copy-link'});
  if(imageTarget)items.push({label:'이미지 주소 복사',icon:'tabler-photo',action:'copy-image'});
  if(editable&&navigator.clipboard?.readText)items.push({label:'붙여넣기',icon:'tabler-clipboard',action:'paste'});
  items.push({label:'모두 선택',icon:'tabler-select-all',action:'select-all'});
  if(items.length)items.push({separator:true});
  items.push({label:'새로고침',icon:'tabler-refresh',action:'reload'});
  items.push({label:'맨 위로',icon:'tabler-arrow-bar-to-up',action:'top'});
  items.push({label:'맨 아래로',icon:'tabler-arrow-bar-to-down',action:'bottom'});
  event.preventDefault();
  openMenu(event,target,items);
}
export function bindAppContextMenu(){
  document.addEventListener('contextmenu',handleContextMenu);
  document.addEventListener('pointerdown',event=>{if(activeMenu&&!activeMenu.element.contains(event.target))closeMenu();});
  document.addEventListener('keydown',event=>{if(!activeMenu&&event.key==='ContextMenu'){const target=document.activeElement;if(target instanceof Element&&target.closest('.production-app')){event.preventDefault();const rect=target.getBoundingClientRect();handleContextMenu({defaultPrevented:false,target,clientX:rect.left+24,clientY:rect.top+24,preventDefault(){}});}}});
  window.addEventListener('resize',()=>closeMenu());
  window.addEventListener('scroll',()=>closeMenu(),true);
}
