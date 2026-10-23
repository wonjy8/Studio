import {matchesMaterialQuery,documentSearchText} from '../domain/material-index.js';
import {selectionToolbar,selectionControl,bindSelection} from './collection-selection.js';
import {request,upload} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {icon} from '../design-system/primitives/icons.js';

const tabs=[['all','전체'],['image','사진'],['video','영상'],['document','문서'],['file','기타 파일'],['link','링크']];
let generation=0;
const kindOf=item=>{
 if(item.kind==='link')return 'link';
 const type=item.mimeType||'';
 if(type.startsWith('image/'))return 'image';
 if(type.startsWith('video/'))return 'video';
 if(type==='application/pdf'||type.startsWith('text/')||/wordprocessingml|spreadsheetml|presentationml|json/.test(type))return 'document';
 return 'file';
};
const labelOf=kind=>({image:'사진',video:'영상',document:'문서',file:'파일',link:'링크'}[kind]||'파일');
const dateLabel=value=>value?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeZone:'Asia/Seoul'}).format(new Date(value)):'업로드 날짜 확인 불가';
const dateValue=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(value)):'';
const safeExternal=value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
export const materialsWorkspacePage=()=>'<section class="materials-workspace" data-materials-workspace><p class="sub">변경 없는 원본과 목록용 썸네일·레퍼런스용 600px 미리보기를 별도로 저장합니다. 미리보기에는 손실 압축이 적용될 수 있습니다.</p><div class="materials-toolbar"><label class="field materials-search"><span>모든 자료 검색</span><input type="search" data-material-search placeholder="제목·파일명·문서 내용·형식·해상도·비율·가로/세로·색상·밝기"></label><label class="field"><span>분류</span><select data-material-category><option value="">모든 분류</option></select></label><label class="field"><span>업로드 날짜</span><input type="date" data-material-date></label><label class="field"><span>정렬</span><select data-material-sort><option value="newest">최근 업로드</option><option value="oldest">오래된 업로드</option><option value="title">제목순</option></select></label><label class="btn primary materials-upload">자료 업로드<input type="file" multiple data-material-upload accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/csv,application/json,application/zip,.docx,.xlsx,.pptx,.mp3,.wav,.ogg"></label><button class="btn" type="button" data-material-link-add>링크 추가</button></div><nav class="materials-tabs" aria-label="자료 유형">'+tabs.map(([key,label])=>'<button type="button" data-material-kind="'+key+'" aria-pressed="'+(key==='all')+'">'+label+'</button>').join('')+'</nav><form class="card materials-link-form" data-material-link-form hidden><div class="section-head"><h2>링크 추가</h2><button class="btn" type="button" data-material-link-close>닫기</button></div><div class="materials-link-fields"><label class="field">링크<input type="url" name="url" required maxlength="2000" placeholder="https://"></label><label class="field">제목<input name="title" maxlength="300" placeholder="비워두면 미리보기 제목을 사용합니다"></label><label class="field">분류<input name="category" maxlength="80"></label><label class="field">태그<input name="tags" maxlength="800" placeholder="쉼표로 구분"></label></div><label class="field">메모<textarea name="description" maxlength="1000"></textarea></label><button class="btn primary" type="submit">저장</button><p class="sub" data-material-link-message role="status"></p></form>'+selectionToolbar('material')+'<p class="sub" data-material-message role="status"></p><button class="btn" type="button" data-material-preview-retry hidden>미리보기 저장 다시 시도</button><div class="materials-gallery" data-material-gallery></div><dialog class="materials-dialog" data-material-dialog></dialog></section>';
export async function bindMaterialsWorkspace({state,documentId,onSelectDocument,onOpenProject,onRemoveProjectDocuments}={}){
 const root=document.querySelector('[data-materials-workspace]');if(!root)return;
 const current=++generation,alive=()=>root.isConnected&&generation===current;
 const gallery=root.querySelector('[data-material-gallery]'),message=root.querySelector('[data-material-message]'),dialog=root.querySelector('[data-material-dialog]');
 const search=root.querySelector('[data-material-search]'),category=root.querySelector('[data-material-category]'),date=root.querySelector('[data-material-date]'),sort=root.querySelector('[data-material-sort]'),linkForm=root.querySelector('[data-material-link-form]');
 const pendingPreviews=[];const selected=new Map();let items=[],docs=[],documentDates={},kind='all',busy=false;
 const workspaces=[state,...(state?.projects||[])].filter(project=>!project.project?.placeholder);
 const detail=(item)=>item.kind==='document'?(item.projectId?onOpenProject?.(item.projectId,item.documentId):onSelectDocument?.(item.documentId)):openItem(item);
 function documentItems(){
  const own=docs.map(doc=>({id:'doc-'+doc.id,kind:'document',title:doc.title,description:documentSearchText(doc,260),searchText:documentSearchText(doc),category:'내 문서',tags:[],uploadedAt:documentDates['account:'+doc.id]||null,documentId:doc.id,sourceDocument:doc,source:'내 문서'}));
  const project=workspaces.flatMap(space=>(space.documents||[]).map(doc=>({id:'doc-'+space.project.id+'-'+doc.id,kind:'document',title:doc.title,description:documentSearchText(doc,260),searchText:documentSearchText(doc),category:space.project.name,tags:[],uploadedAt:documentDates[space.project.id+':'+doc.id]||null,documentId:doc.id,sourceDocument:doc,projectId:space.project.id,source:space.project.name})));
  return [...own,...project];
 }
 function preview(item){
  const url='/api/files/'+encodeURIComponent(item.fileId);
  if(item.kind==='link'&&item.previewImage){return '<img loading="lazy" src="/api/materials/'+esc(item.id)+'/preview-image" alt="">';}
  const type=item.mimeType||'';
  if(type.startsWith('image/'))return item.thumbnailAvailable?'<img loading="lazy" decoding="async" src="'+url+'?preview=1" alt="'+esc(item.title)+'">':'<span class="materials-preview-placeholder">'+icon('folder')+'<span>원본 열기</span></span>';
  if(type.startsWith('video/'))return '<span class="materials-preview-placeholder">'+icon('folder')+'<span>영상 열기</span></span>';
  if(item.kind==='link')return '<span class="materials-preview-placeholder">'+icon('link')+'</span>';
  return '<span class="materials-preview-placeholder">'+icon(item.kind==='document'?'tabler-file-text':'folder')+'</span>';
 }
 function card(item){
  const kind=item.kind==='link'?'link':item.kind==='document'?'document':kindOf(item),tags=(item.tags||[]).map(tag=>'<span class="materials-tag">#'+esc(tag)+'</span>').join('');
  const title=item.previewTitle||item.title,description=item.previewDescription||item.description||item.source||'',actions=item.kind==='document'?'':'<div class="materials-card-actions"><button class="btn" type="button" data-material-edit="'+esc(item.id)+'">정보 수정</button><button class="btn" type="button" data-material-reference="'+esc(item.id)+'">레퍼런스에 추가</button><button class="btn danger" type="button" data-material-delete="'+esc(item.id)+'">삭제</button></div>';
  const external=item.kind==='link'?safeExternal(item.url):'';
  return '<article class="materials-card" data-material-card="'+esc(item.id)+'">'+selectionControl('material',item,selected)+'<button class="materials-card-preview" type="button" data-material-open="'+esc(item.id)+'" aria-label="'+esc(item.title)+' 열기">'+preview(item)+'</button><div class="materials-card-body"><div class="materials-card-meta"><span>'+labelOf(kind)+'</span><time>'+dateLabel(item.uploadedAt)+'</time></div><button class="materials-card-title" type="button" data-material-open="'+esc(item.id)+'">'+esc(title)+'</button>'+(description?'<p>'+esc(description)+'</p>':'')+(external?'<a class="materials-card-url" href="'+esc(external)+'" target="_blank" rel="noopener noreferrer">'+esc(item.url)+'</a>':'')+(item.category?'<span class="materials-category">'+esc(item.category)+'</span>':'')+(item.metadata?.width?'<p class="sub materials-dimensions">'+esc(item.metadata.width+' × '+item.metadata.height)+' · '+({landscape:'가로',portrait:'세로',square:'정사각형'}[item.metadata.orientation]||'')+'</p>':'')+'<div class="materials-tags">'+tags+'</div>'+actions+'</div></article>';
 }
 function updateCategories(){
  const values=[...new Set([...items,...documentItems()].map(item=>item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')),old=category.value;
  category.innerHTML='<option value="">모든 분류</option>'+values.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');
  if(values.includes(old))category.value=old;
 }
 function draw(){
  if(!alive())return;
  const query=search.value.trim().toLocaleLowerCase(),selectedDate=date.value,categoryValue=category.value;
  const filtered=[...items,...documentItems()].filter(item=>(kind==='all'||(item.kind==='link'?kind==='link':item.kind==='document'?kind==='document':kindOf(item)===kind))&&(!categoryValue||item.category===categoryValue)&&(!selectedDate||item.uploadedAt&&dateValue(item.uploadedAt)===selectedDate)&&matchesMaterialQuery(item,query));
  filtered.sort((a,b)=>sort.value==='title'?a.title.localeCompare(b.title,'ko'):sort.value==='oldest'?(a.uploadedAt||Infinity)-(b.uploadedAt||Infinity):(b.uploadedAt||0)-(a.uploadedAt||0));
  gallery.innerHTML=filtered.map(card).join('')||'<div class="workspace-empty">조건에 맞는 자료가 없습니다.</div>';
  bindSelection({root,prefix:'material',items:filtered,selected,draw,onDelete:removeSelected,busy});gallery.querySelectorAll('button').forEach(button=>button.disabled=busy);[search,category,date,sort].forEach(input=>input.disabled=busy);
  gallery.querySelectorAll('[data-material-open]').forEach(button=>button.onclick=()=>detail(filtered.find(item=>item.id===button.dataset.materialOpen)));
  gallery.querySelectorAll('[data-material-edit]').forEach(button=>button.onclick=()=>edit(filtered.find(item=>item.id===button.dataset.materialEdit)));
  gallery.querySelectorAll('[data-material-delete]').forEach(button=>button.onclick=()=>void remove(filtered.find(item=>item.id===button.dataset.materialDelete)));
  gallery.querySelectorAll('[data-material-reference]').forEach(button=>button.onclick=()=>void addToReference(filtered.find(item=>item.id===button.dataset.materialReference)));
 }
 function setMessage(text,error=false){message.textContent=text;message.setAttribute('role',error?'alert':'status');}
 function refresh(){return Promise.all([request('materials'),request('document-library')]).then(([result,accountDocs])=>{items=result.items||[];docs=accountDocs.documents||[];documentDates=result.documentDates||{};for(const [id,prior] of selected){const now=[...items,...documentItems()].find(item=>item.id===id);if(!now||(now.kind==='document'?JSON.stringify(now.sourceDocument)!==JSON.stringify(prior.sourceDocument):now.updatedAt!==prior.updatedAt))selected.delete(id);}updateCategories();draw();});}
 function openItem(item){
  if(item.kind==='document'){detail(item);return;}
  const body=item.kind==='link'?(item.previewImage?'<img class="materials-dialog-image" src="/api/materials/'+esc(item.id)+'/preview-image" alt="">':'')+(item.previewTitle?'<h2>'+esc(item.previewTitle)+'</h2>':'<h2>'+esc(item.title)+'</h2>')+(item.previewDescription?'<p>'+esc(item.previewDescription)+'</p>':'')+'<a class="btn primary" href="'+esc(safeExternal(item.url))+'" target="_blank" rel="noopener noreferrer">링크 열기</a>':(item.mimeType||'').startsWith('image/')?'<img class="materials-dialog-image" src="/api/files/'+esc(item.fileId)+'" alt="'+esc(item.title)+'">':(item.mimeType||'').startsWith('video/')?'<video class="materials-dialog-video" controls autoplay src="/api/files/'+esc(item.fileId)+'"></video>':'<div class="materials-file-open">'+icon('tabler-file-text')+'<h2>'+esc(item.title)+'</h2><p>'+esc(item.mimeType||'파일')+' · '+(item.size||0)+' bytes</p><a class="btn primary" href="/api/files/'+esc(item.fileId)+'?download">다운로드</a></div>';
  dialog.innerHTML='<div class="materials-dialog-content"><header><h2>'+esc(item.title)+'</h2><button class="btn" type="button" data-dialog-close>닫기</button></header>'+body+'<p class="sub">'+dateLabel(item.uploadedAt)+(item.category?' · '+esc(item.category):'')+'</p></div>';
  dialog.querySelector('[data-dialog-close]').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.replaceChildren();};dialog.showModal();
 }
 function edit(item){
  dialog.innerHTML='<form class="form materials-edit-form"><header><h2>자료 정보</h2><button class="btn" type="button" data-dialog-close>닫기</button></header><label class="field">제목<input name="title" maxlength="300" required value="'+esc(item.title)+'"></label><label class="field">분류<input name="category" maxlength="80" value="'+esc(item.category||'')+'"></label><label class="field">태그<input name="tags" maxlength="800" value="'+esc((item.tags||[]).join(', '))+'"></label><label class="field">메모<textarea name="description" maxlength="1000">'+esc(item.description||'')+'</textarea></label><p class="sub">업로드 날짜 · '+dateLabel(item.uploadedAt)+'</p><div class="actions"><button class="btn primary" type="submit">저장</button><button class="btn" type="button" data-dialog-close>취소</button></div><p role="status"></p></form>';
  dialog.querySelectorAll('[data-dialog-close]').forEach(button=>button.onclick=()=>dialog.close());
  dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target;form.querySelector('[type=submit]').disabled=true;try{await request('materials/'+encodeURIComponent(item.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(form)),tags:form.elements.tags.value})});dialog.close();await refresh();setMessage('자료 정보를 저장했습니다.');}catch(error){form.querySelector('[role=status]').textContent=error.message;form.querySelector('[type=submit]').disabled=false;}};
  dialog.showModal();
 }
 async function deleteItem(item){
  if(item.kind==='document'){
   if(item.projectId){if(!onRemoveProjectDocuments)throw Error('프로젝트 문서는 프로젝트 화면에서 삭제하세요.');const result=await onRemoveProjectDocuments(item.projectId,[item.sourceDocument]);const space=workspaces.find(p=>p.project.id===item.projectId);if(space)space.documents=result.documents;}
   else{const current=await request('document-library'),doc=current.documents.find(doc=>doc.id===item.documentId);if(!doc||JSON.stringify(doc)!==JSON.stringify(item.sourceDocument))throw Error('문서가 변경되었습니다. 새로고침 후 다시 선택해 주세요.');const saved=await request('document-library',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:current.documents.filter(doc=>doc.id!==item.documentId),revision:current.revision})});docs=saved.documents;}
  }else await request('materials/'+encodeURIComponent(item.id),{method:'DELETE',headers:{'If-Match':String(item.updatedAt)}});
 }
 async function removeSelected(){
  if(busy||!selected.size)return;const chosen=[...selected.values()];if(!confirm('선택한 '+chosen.length+'개 자료를 영구 삭제할까요? 문서와 업로드 파일 원본도 삭제되며 앱에서 복구할 수 없습니다. 외부 링크의 원본 사이트와 레퍼런스 원본은 삭제하지 않습니다.'))return;
  busy=true;draw();const failed=[];let removed=0;try{for(const item of chosen){if(!alive())break;try{await deleteItem(item);selected.delete(item.id);removed++;}catch(error){failed.push(item.title+': '+error.message);}}if(alive()){await refresh();setMessage(removed+'개 삭제'+(failed.length?' · '+failed.length+'개 유지: '+failed.join(' / '):''),Boolean(failed.length));}}catch(error){if(alive())setMessage(error.message,true);}finally{busy=false;if(alive())draw();}
 }
 async function remove(item){if(busy||!item)return;if(!confirm('“'+item.title+'” 자료를 영구 삭제할까요? 업로드 파일 원본은 앱에서 복구할 수 없습니다.'))return;busy=true;try{await deleteItem(item);selected.delete(item.id);await refresh();setMessage('자료를 삭제했습니다.');}catch(error){setMessage(error.message,true);}finally{busy=false;if(alive())draw();}}
 async function addToReference(item){
  try{
   const result=await request('reference-library'),references=result.references||[];
   if(!references.length){if(!confirm('레퍼런스가 없습니다. 이 자료로 새 레퍼런스를 만들까요?'))return;await createReference(item,'');}
   else{
    dialog.innerHTML='<div class="materials-reference-picker"><header><h2>레퍼런스에 추가</h2><button class="btn" type="button" data-dialog-close>닫기</button></header><label class="field">레퍼런스 선택<select data-reference-target>'+references.map(ref=>'<option value="'+esc(ref.id)+'">'+esc(ref.name)+'</option>').join('')+'</select></label><button class="btn primary" type="button" data-reference-confirm>추가</button><p role="status"></p></div>';
    dialog.querySelector('[data-dialog-close]').onclick=()=>dialog.close();
    dialog.querySelector('[data-reference-confirm]').onclick=async()=>{
     const ref=references.find(row=>row.id===dialog.querySelector('[data-reference-target]').value);if(!ref)return;
     const body={name:ref.name,notes:ref.notes||'',url:ref.url||'',tags:ref.tags||'',collection:ref.collection||'',files:[...(ref.files||[])],images:[...(ref.images||[])],revision:ref.revision};
     if(item.kind==='link'){await createReference(item,ref.collection||ref.name);dialog.close();return;}
     if((item.mimeType||'').startsWith('image/')||(item.mimeType||'').startsWith('video/'))body.images.push('/api/files/'+item.fileId);else body.files.push(item.fileId);
     const dedup=(values)=>[...new Set(values)];
     body.images=dedup(body.images);body.files=dedup(body.files);
     await request('reference-library/'+encodeURIComponent(ref.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
     dialog.close();setMessage('레퍼런스에 추가했습니다.');
    };
    dialog.showModal();
   }
  }catch(error){setMessage(error.message,true);}
 }
 async function createReference(item,collection){
  const body={name:item.title,notes:item.description||'',url:item.kind==='link'?item.url:'',tags:(item.tags||[]).join(', '),collection,images:[],files:[]};
  if(item.kind==='link'){}else if((item.mimeType||'').startsWith('image/')||(item.mimeType||'').startsWith('video/'))body.images.push('/api/files/'+item.fileId);else body.files.push(item.fileId);
  await request('reference-library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  setMessage('자료로 레퍼런스를 만들었습니다.');
 }
 root.querySelectorAll('[data-material-kind]').forEach(button=>button.onclick=()=>{selected.clear();kind=button.dataset.materialKind;root.querySelectorAll('[data-material-kind]').forEach(tab=>{tab.setAttribute('aria-pressed',String(tab===button));tab.classList.toggle('active',tab===button);});draw();});
 [search,category,date,sort].forEach(input=>input.addEventListener('input',()=>{selected.clear();draw();}));
 root.querySelector('[data-material-link-add]').onclick=()=>{linkForm.hidden=!linkForm.hidden;if(!linkForm.hidden)linkForm.elements.url.focus();};
 root.querySelector('[data-material-link-close]').onclick=()=>{linkForm.hidden=true;};
 linkForm.onsubmit=async event=>{event.preventDefault();const form=event.target,submit=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');submit.disabled=true;status.textContent='미리보기를 불러오는 중…';try{const data=Object.fromEntries(new FormData(form));const result=await request('materials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});items.unshift(result.item);updateCategories();form.reset();form.hidden=true;draw();setMessage('링크를 자료에 추가했습니다.');}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}};
 root.querySelector('[data-material-preview-retry]').onclick=async()=>{
  if(busy)return;busy=true;const button=root.querySelector('[data-material-preview-retry]');button.disabled=true;
  try{while(pendingPreviews.length){await pendingPreviews[0]();pendingPreviews.shift();}await refresh();setMessage('미리보기를 저장했습니다. 원본은 다시 업로드하지 않았습니다.');}catch(error){setMessage('원본은 저장되어 있습니다. 미리보기 저장 실패: '+error.message,true);}finally{busy=false;if(alive()){button.disabled=false;button.hidden=!pendingPreviews.length;}}
 };
 root.querySelector('[data-material-upload]').onchange=async event=>{if(busy)return;busy=true;const input=event.target;input.disabled=true;setMessage('파일을 업로드하고 있습니다.');try{let previewMissing=0;for(const file of [...input.files]){if(!alive())break;const saved=await upload(file,{accept:alive});if(file.type.startsWith('image/')&&!saved.previewStored)previewMissing++;if(saved.retryPreviews&&pendingPreviews.length<4)pendingPreviews.push(saved.retryPreviews);}if(alive()){await refresh();setMessage('원본 파일을 모든 자료에 추가했습니다.'+(previewMissing?' '+previewMissing+'개 이미지는 미리보기 없이 저장했습니다. 원본 열기를 사용해 주세요.':''));}}catch(error){setMessage(error.message,true);try{await refresh();}catch{}}finally{busy=false;if(alive()){input.disabled=false;input.value='';root.querySelector('[data-material-preview-retry]').hidden=!pendingPreviews.length;draw();}}};
 try{
  const [library,accountDocs]=await Promise.all([request('materials'),request('document-library')]);
  if(!alive())return;
  items=library.items||[];documentDates=library.documentDates||{};docs=accountDocs.documents||[];
  updateCategories();draw();
 }catch(error){if(alive())setMessage(error.message,true);}
}
