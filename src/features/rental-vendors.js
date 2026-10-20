import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {icon} from '../design-system/primitives/icons.js';
const fields=[['name','대여소명'],['contact','담당자'],['phone','전화'],['email','이메일'],['website','웹사이트'],['address','주소'],['notes','메모']];
let active;
export const rentalVendorsCanLeave=()=>!active?.root.isConnected||active.leave();
export const rentalVendorsDraftPending=()=>Boolean(active?.root.isConnected&&active.dirty());
export const rentalVendorsPage=()=>'<section class="rental-vendors browse-workspace" data-rental-vendors><div class="browse-toolbar"><label class="field browse-search">대여소 검색<input type="search" data-vendor-search placeholder="대여소명·담당자·주소"></label><button class="btn primary" type="button" data-new-vendor>+ 대여소</button></div><p role="status" data-vendor-message></p><section data-vendor-editor></section><div class="catalog-grid" data-vendor-list></div></section>';
export async function bindRentalVendors(){
 const root=document.querySelector('[data-rental-vendors]');if(!root)return;
 let vendors=[],selected=null,busy=false,baseline='',editorOpen=false;
 const list=root.querySelector('[data-vendor-list]'),editor=root.querySelector('[data-vendor-editor]'),message=root.querySelector('[data-vendor-message]'),search=root.querySelector('[data-vendor-search]');
 const snapshot=()=>{const form=editor.querySelector('form');return form?JSON.stringify(Object.fromEntries(new FormData(form))):'';};
 const dirty=()=>busy||snapshot()!==baseline,leave=()=>!busy&&(!dirty()||confirm('저장하지 않은 대여소 입력을 닫을까요?'));
 active={root,dirty,leave};
 function tell(text,error=false){message.textContent=text;message.setAttribute('role',error?'alert':'status');}
 function drawList(){
  const query=search.value.trim().toLocaleLowerCase();
  const filtered=vendors.filter(v=>[v.name,v.address,v.contact,v.phone,v.email].join(' ').toLocaleLowerCase().includes(query));
  list.innerHTML=filtered.map(v=>'<button class="catalog-card" type="button" data-vendor-id="'+esc(v.id)+'" aria-pressed="'+(v.id===selected?.id)+'"><span class="catalog-photo catalog-photo-empty" role="img" aria-label="대여소">'+icon('folder')+'</span><strong>'+esc(v.name)+'</strong><span class="sub">'+esc(v.address||v.contact||'주소 미등록')+'</span><span class="sub">'+esc([v.phone,v.email].filter(Boolean).join(' · '))+'</span></button>').join('')||'<div class="workspace-empty">검색 결과가 없습니다.</div>';
  list.querySelectorAll('[data-vendor-id]').forEach(button=>button.onclick=()=>{if(!leave())return;selected=vendors.find(v=>v.id===button.dataset.vendorId);editorOpen=true;draw();});
 }
 function draw(){
  drawList();
  if(!editorOpen){editor.replaceChildren();baseline='';return;}
  const formFields=fields.map(([key,label])=>'<label class="field">'+label+(key==='notes'?'<textarea name="'+key+'" maxlength="2000">'+esc(selected?.[key]||'')+'</textarea>':'<input name="'+key+'" value="'+esc(selected?.[key]||'')+'" maxlength="2000" '+(key==='name'?'required ':'')+(key==='website'?'type="url"':key==='email'?'type="email"':'' )+'>')+'</label>').join('');
  editor.innerHTML='<section class="card rental-vendor-editor"><div class="section-head"><h2>'+esc(selected?.name||'대여소 추가')+'</h2><button class="btn" type="button" data-vendor-close>닫기</button></div><form class="form catalog-edit-form" data-vendor-form>'+formFields+'<div class="actions"><button class="btn primary" type="submit">저장</button>'+(selected?'<button class="btn danger" type="button" data-delete-vendor>삭제</button>':'')+'</div></form></section>';
  const form=editor.querySelector('form');baseline=snapshot();form.onsubmit=event=>{event.preventDefault();void mutate('POST',Object.fromEntries(new FormData(form)));};
  editor.querySelector('[data-vendor-close]').onclick=()=>{if(!leave())return;editorOpen=false;selected=null;draw();search.focus();};
  editor.querySelector('[data-delete-vendor]')?.addEventListener('click',()=>{if(confirm('대여소를 삭제할까요? 프로젝트의 기존 대여소 이름은 유지됩니다.'))void mutate('DELETE',{});});
 }
 async function mutate(method,data){
  if(busy)return;busy=true;root.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=true);
  try{
   const result=await request('rental-vendors'+(selected?'/'+selected.id:''),{method:selected&&method==='POST'?'PUT':method,headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,...(selected?{revision:selected.revision}:{})})});
   if(!root.isConnected)return;
   selected=result.vendor||null;editorOpen=Boolean(result.vendor);
   vendors=(await request('rental-vendors')).vendors;
   if(root.isConnected){draw();tell('저장됐습니다.');}
  }catch(error){tell(error.message,true);}
  finally{busy=false;if(root.isConnected)root.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=false);}
 }
 search.oninput=drawList;
 root.querySelector('[data-new-vendor]').onclick=()=>{if(!leave())return;selected=null;editorOpen=true;draw();editor.querySelector('input')?.focus();};
 try{vendors=(await request('rental-vendors')).vendors;if(root.isConnected)draw();}
 catch(error){tell(error.message,true);}
}
export async function bindRentalVendorPicker(){
 const form=document.querySelector('[data-form=gear]');if(!form)return;
 const select=form.elements.vendorId;if(!select)return;
 try{const {vendors}=await request('rental-vendors');if(!form.isConnected)return;select.innerHTML='<option value="">직접 입력</option>'+vendors.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');select.disabled=false;select.onchange=()=>{const vendor=vendors.find(v=>v.id===select.value);if(vendor)form.elements.owner.value=vendor.name;};}
 catch{select.disabled=true;}
}