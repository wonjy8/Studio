import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {newQtItem} from '../domain/qt-journal.js';
import {renderRuns,readRuns} from './documents.js';

// Both the QT editor and Home use the same numbered, borderless gratitude editor.
export function bindQtGratitude(root,journal,{onChange}){
 const list=root.querySelector('[data-qt-gratitude]');
 function draw(){
  list.innerHTML=journal.gratitude.map((item,index)=>`<li data-qt-item="${esc(item.id)}"><div class="qt-item-content"><div class="qt-document-input" contenteditable="true" role="textbox" aria-multiline="true" aria-label="감사 ${index+1}" data-qt-item-text data-placeholder="내용을 입력하세요">${renderRuns(item.content||(item.text?[{text:item.text}]:[]))}</div></div><button class="btn ghost qt-item-remove" data-qt-item-remove aria-label="감사 ${index+1} 삭제">×</button></li>`).join('');
  list.querySelectorAll('[data-qt-item]').forEach(row=>{const item=journal.gratitude.find(item=>item.id===row.dataset.qtItem),input=row.querySelector('[data-qt-item-text]');
   input.addEventListener('paste',event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
   input.oninput=()=>{item.content=readRuns(input);item.text=item.content.map(run=>run.text).join('');onChange();};
   input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();add(journal.gratitude.indexOf(item)+1);}};
   row.querySelector('[data-qt-item-remove]').onclick=()=>{journal.gratitude=journal.gratitude.filter(value=>value.id!==item.id);draw();onChange();};
  });
 }
 function add(index=journal.gratitude.length){if(journal.gratitude.length>=500)return;const item=newQtItem();journal.gratitude.splice(index,0,item);draw();list.querySelector(`[data-qt-item="${item.id}"] [data-qt-item-text]`).focus();onChange();}
 root.querySelector('[data-qt-add-gratitude]').onclick=()=>add();draw();
}
