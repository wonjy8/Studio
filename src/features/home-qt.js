import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {icon} from '../design-system/primitives/icons.js';
import {scriptureToday} from '../domain/scripture.js';
import {journalForQt,newQtItem,legacyQtVerses} from '../domain/qt-journal.js';
import {presentBibleVerse} from '../domain/bible-presentation.js';

export function appendHomeGratitude(note,text){
 const value=text.trim();if(!value||value.length>20000)throw Error('감사제목은 1~20000자로 입력하세요.');
 const result=Object.fromEntries(['document','kind','date','passage','speaker','sourceUrl','properties','categories','qtVerses'].filter(key=>note[key]!==undefined).map(key=>[key,structuredClone(note[key])]));
 result.qtJournal=journalForQt(note);
 const empty=result.qtJournal.gratitude.find(item=>!item.text.trim());
 if(empty){empty.text=value;delete empty.content;}else{if(result.qtJournal.gratitude.length>=500)throw Error('감사제목은 최대 500개입니다.');result.qtJournal.gratitude.push({...newQtItem(),text:value});}
 return result;
}
export async function bindHomeQt({onOpen}){
 const root=document.querySelector('[data-home-qt]');if(!root)return;
 const today=scriptureToday(),alive=()=>root.isConnected;let note;
 const error=message=>{if(alive()){const status=root.querySelector('[data-home-qt-status]');if(status){status.textContent=message;status.setAttribute('role','alert');}}};
 async function load(){
  root.innerHTML='<p class="sub" role="status">오늘 QT를 불러오는 중…</p>';
  try{
   const data=await request('scripture/notes');if(!alive())return;const existing=data.notes.find(item=>item.kind==='qt'&&item.date===today);
   if(!existing){
    root.innerHTML=`<button class="home-qt-empty" data-home-qt-create><span>${icon('plus')}</span><strong>오늘 QT 만들기</strong><span class="sub">${esc(today)}</span></button><p class="sub" data-home-qt-status role="status"></p>`;
    root.querySelector('[data-home-qt-create]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{const result=await request('scripture/qt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:today})});if(alive())onOpen(result.note.document.id);}catch(e){error(e.message);if(alive())button.disabled=false;}};return;
   }
   const result=await request('scripture/notes/'+existing.document.id);if(!alive())return;note=result.note;
   root.innerHTML=`<div class="section-head"><h2>오늘 QT</h2><button class="btn ghost" data-home-qt-open>${icon('book')} QT 열기</button></div><div class="home-qt-content"><section class="home-qt-scripture"><h3>${esc(note.passage||'성경 본문')}</h3><div data-home-qt-verses><p class="sub" role="status">본문을 불러오는 중…</p></div></section><section class="home-qt-gratitude"><h3>오늘의 감사</h3><ol data-home-gratitude-list></ol><form data-home-gratitude-form><label class="field"><span class="sr-only">감사제목</span><textarea name="gratitude" aria-label="감사제목" placeholder="감사제목 추가" maxlength="20000" required rows="2"></textarea></label><button class="btn" type="submit">${icon('plus')} 감사 추가</button></form><p class="sub" data-home-qt-status role="status"></p></section></div>`;
   root.querySelector('[data-home-qt-open]').onclick=()=>onOpen(note.document.id);
   const draw=()=>{root.querySelector('[data-home-gratitude-list]').innerHTML=journalForQt(note).gratitude.filter(item=>item.text.trim()).map(item=>`<li>${esc(item.text)}</li>`).join('')||'<li class="sub home-qt-no-gratitude">감사제목을 추가해 보세요.</li>';};draw();
   root.querySelector('[data-home-gratitude-form]').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,input=form.elements.gratitude,button=form.querySelector('button'),text=input.value;if(!text.trim())return;input.readOnly=true;button.disabled=true;
    try{const fresh=await request('scripture/notes/'+note.document.id),value=appendHomeGratitude(fresh.note,text),saved=await request('scripture/notes/'+note.document.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:fresh.note.revision,note:value})});if(!alive())return;note=saved.note;input.value='';draw();root.querySelector('[data-home-qt-status]').textContent='저장됨';}catch(e){error(e.message);}finally{if(alive()){input.readOnly=false;button.disabled=false;}}
   };
   try{let verses=note.qtVerses||legacyQtVerses(note);if(!verses.length&&note.passage)verses=(await request('scripture/bible?'+new URLSearchParams({passage:note.passage}))).verses;if(!alive())return;root.querySelector('[data-home-qt-verses]').innerHTML=verses.map(v=>{const parsed=presentBibleVerse(v.text);return parsed.headings.map(h=>`<h4>${esc(h)}</h4>`).join('')+`<p><span class="sub">${v.chapter}:${v.verse}</span> ${esc(parsed.text)}</p>`;}).join('')||'<p class="sub">저장된 본문이 없습니다. QT에서 확인하세요.</p>';}catch(e){if(alive())root.querySelector('[data-home-qt-verses]').textContent=e.message;}
  }catch(e){if(alive()){root.innerHTML='<p class="sub" data-home-qt-status role="alert"></p><button class="btn" data-home-qt-retry>다시 불러오기</button>';error(e.message);root.querySelector('[data-home-qt-retry]').onclick=()=>void load();}}
 }
 await load();
}
