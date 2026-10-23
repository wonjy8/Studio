import {request} from '../integrations/api.js';
import {icon} from '../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {newDocument,blockText} from '../domain/documents.js';
import {bindDocuments,documentsPage,flushDocuments,releaseDocuments} from './documents.js';
let generation=0;
const browsing={query:'',scope:'all',project:'',sort:'title'};
export const documentWorkspacePage=()=>'<section class="document-browser" data-document-browser><p role="status">문서를 불러오는 중…</p></section>';
export async function bindDocumentWorkspace({state,namespace,documentId,onSelect,onOpenProject}){
 const root=document.querySelector('[data-document-browser]');if(!root)return;const current=++generation;let data,references=[],opening=0;
 const alive=()=>root.isConnected&&current===generation;
 try{const results=await Promise.allSettled([request('document-library'),request('reference-library')]);if(!alive())return;if(results[0].status==='rejected')throw results[0].reason;data=results[0].value;if(results[1].status==='fulfilled')references=results[1].value.references.map(ref=>({...ref,libraryId:ref.id}));}catch(error){if(alive()){root.innerHTML=`<p role="alert">${esc(error.message)}</p><button class="btn" data-document-load-retry>다시 불러오기</button>`;root.querySelector('button').onclick=()=>bindDocumentWorkspace({state,namespace,documentId,onSelect,onOpenProject});}return;}
 const tabHost=document.querySelector('[data-document-browser-tabs]');
 const projects=[state,...(state.projects||[])].filter(p=>!p.project.placeholder);
 function browse(){
  opening++;
  root.innerHTML=`<div class="document-browse-tools"><label class="field"><span class="sr-only">문서 검색</span><input type="search" data-document-search placeholder="문서 검색" value="${esc(browsing.query)}"></label><label class="field"><span class="sr-only">프로젝트 필터</span><select data-document-project><option value="">모든 프로젝트</option>${projects.map(p=>`<option value="${esc(p.project.id)}" ${browsing.project===p.project.id?'selected':''}>${esc(p.project.name)}</option>`).join('')}</select></label><label class="field"><span class="sr-only">문서 정렬</span><select data-document-sort><option value="title" ${browsing.sort==='title'?'selected':''}>이름순</option><option value="source" ${browsing.sort==='source'?'selected':''}>위치순</option></select></label><button class="btn primary" data-document-create>${icon('plus')} 문서</button></div><nav class="project-tabs document-browse-tabs" aria-label="문서 분류">${[['all','전체'],['personal','내 문서'],['project','프로젝트 문서']].map(([key,label])=>`<button type="button" data-document-scope="${key}" class="project-tab ${browsing.scope===key?'active':''}" ${browsing.scope===key?'aria-current="page"':''}>${label}</button>`).join('')}</nav><div class="document-browse-results" data-document-results></div>`;
  root.querySelector('[data-document-search]').oninput=e=>{browsing.query=e.target.value;list();};root.querySelector('[data-document-project]').onchange=e=>{browsing.project=e.target.value;list();};root.querySelector('[data-document-sort]').onchange=e=>{browsing.sort=e.target.value;list();};root.querySelectorAll('[data-document-scope]').forEach(button=>button.onclick=()=>{browsing.scope=button.dataset.documentScope;browse();});root.querySelector('[data-document-create]').onclick=()=>{if(data.documents.length>=100){alert('문서는 최대 100개입니다.');return;}const doc=newDocument();data.documents.push(doc);edit(doc.id,true);};if(tabHost)tabHost.replaceChildren(root.querySelector('.document-browse-tabs'));list();
 }
 function list(){
  const rows=[...data.documents.map(doc=>({doc,source:'내 문서',project:null})),...projects.flatMap(p=>(p.documents||[]).map(doc=>({doc,source:p.project.name,project:p.project.id})))],q=browsing.query.trim().toLocaleLowerCase();
  const filtered=rows.filter(row=>(browsing.scope==='all'||(browsing.scope==='personal'?!row.project:Boolean(row.project)))&&(!browsing.project||row.project===browsing.project)&&(!q||[row.doc.title,row.source,...row.doc.blocks.map(blockText)].join(' ').toLocaleLowerCase().includes(q))).sort((a,b)=>(browsing.sort==='source'?a.source.localeCompare(b.source,'ko'):0)||a.doc.title.localeCompare(b.doc.title,'ko'));
  const results=root.querySelector('[data-document-results]');results.innerHTML=`<p class="sub" role="status">${filtered.length}개 문서</p><div class="document-browse-list">${filtered.map((row,i)=>`<button type="button" class="document-browse-row" data-document-open="${i}">${icon('tabler-file-text')}<span class="document-browse-copy"><span class="document-browse-name">${esc(row.doc.title)}</span><span class="sub">${esc(row.doc.blocks.map(blockText).filter(Boolean).join(' ').slice(0,140)||'내용 없음')}</span></span><span class="document-browse-source">${esc(row.source)}</span>${icon('chevron')}</button>`).join('')||'<div class="empty">문서가 없습니다.</div>'}</div>`;
  results.querySelectorAll('[data-document-open]').forEach(button=>button.onclick=()=>{const row=filtered[Number(button.dataset.documentOpen)];if(row.project)onOpenProject(row.project,row.doc.id);else refreshAndEdit(row.doc.id);});
 }
 async function refreshAndEdit(id){
  const attempt=++opening,status=root.querySelector('[data-document-results] > [role="status"]');
  if(status)status.textContent='문서의 최신 내용을 확인하는 중…';
  try{
   const latest=await request('document-library');
   if(!alive()||attempt!==opening)return;
   data=latest;
   if(!data.documents.some(doc=>doc.id===id)){browse();return;}
   edit(id);
  }catch(error){if(alive()&&attempt===opening&&status)status.textContent='최신 내용을 확인하지 못했습니다. '+error.message+' 문서를 다시 선택해 주세요.';}
 }
 function edit(id,initialDirty=false){
  opening++;
  tabHost?.replaceChildren();
  root.innerHTML=`<div class="document-browse-back"><button class="btn ghost" data-documents-back>문서 목록</button><span class="sub">내 문서</span></div>${documentsPage()}`;onSelect(id);
  bindDocuments({project:{id:'account-documents',name:'문서'},documents:data.documents,refs:references},{namespace:namespace+':library',initialDocumentId:id,initialDirty,onDocumentSelect:onSelect,onPersist:async documents=>{const saved=await request('document-library',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents,revision:data.revision})});data=saved;return {refs:references};},onPickReference:async libraryId=>{const result=await request('reference-library');references=result.references.map(ref=>({...ref,libraryId:ref.id}));const ref=references.find(r=>r.id===libraryId);if(!ref)throw Error('레퍼런스를 찾을 수 없습니다.');return ref;}});
  root.querySelector('[data-documents-back]').onclick=async()=>{try{await flushDocuments();if(!alive())return;onSelect(null);browse();releaseDocuments();}catch{/* Editor retains the unsaved text and retry control. */}};
 }
 if(documentId&&data.documents.some(d=>d.id===documentId))edit(documentId);else{if(documentId)onSelect(null);browse();releaseDocuments();}
}
