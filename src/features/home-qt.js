import {addSurface} from '../design-system/primitives/add-surface.js';
import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {icon} from '../design-system/primitives/icons.js';
import {scriptureToday} from '../domain/scripture.js';
import {journalForQt,newQtItem} from '../domain/qt-journal.js';
import {bindQtGratitude} from './qt-gratitude.js';
import {scriptureAutosave,flushScriptureDrafts} from './scripture-drafts.js';

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
    let passage='';try{passage=(await request('scripture/qt?date='+encodeURIComponent(today))).reading?.passage||'';}catch{}if(!alive())return;
    root.innerHTML=`${addSurface({title:'오늘 QT 만들기',description:[today,passage||'본문 확인 불가'].join(' · '),attributes:'data-home-qt-create',className:'home-qt-empty'})}<p class="sub" data-home-qt-status role="status"></p>`;
    root.querySelector('[data-home-qt-create]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{const result=await request('scripture/qt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:today})});if(alive())onOpen(result.note.document.id);}catch(e){error(e.message);if(alive())button.disabled=false;}};return;
   }
   const result=await request('scripture/notes/'+existing.document.id);if(!alive())return;note=result.note;
   root.innerHTML=`<div class="section-head"><h2>오늘 QT</h2><button class="btn ghost" data-home-qt-open>${icon('book')} QT 열기</button></div><div class="home-qt-content"><section class="home-qt-scripture"><h3>${esc(note.passage||'성경 구절 없음')}</h3></section><section class="home-qt-gratitude qt-journal"><h3>오늘의 감사</h3><ol data-qt-gratitude></ol><button class="btn ghost" data-qt-add-gratitude>+ 감사</button><p class="sub" data-home-qt-status role="status"></p><button class="btn" data-scripture-save-retry hidden>저장 재시도</button></section></div>`;
   const journal=journalForQt(note),saver=scriptureAutosave({root,status:root.querySelector('[data-home-qt-status]'),quiet:true,read:()=>({...Object.fromEntries(['document','kind','date','passage','speaker','sourceUrl','properties','categories','qtVerses'].filter(key=>note[key]!==undefined).map(key=>[key,structuredClone(note[key])])),qtJournal:journal}),save:async value=>{const result=await request('scripture/notes/'+note.document.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:note.revision,note:value})});note=result.note;}});
   bindQtGratitude(root,journal,{onChange:()=>saver.change()});
   root.querySelector('[data-home-qt-open]').onclick=async()=>{try{await flushScriptureDrafts();if(alive())onOpen(note.document.id);}catch{/* Keep the unsaved gratitude and retry visible. */}};

  }catch(e){if(alive()){root.innerHTML='<p class="sub" data-home-qt-status role="alert"></p><button class="btn" data-home-qt-retry>다시 불러오기</button>';error(e.message);root.querySelector('[data-home-qt-retry]').onclick=()=>void load();}}
 }
 await load();
}
