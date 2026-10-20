import {request} from '../integrations/api.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {documentColors,documentBackgrounds} from '../domain/documents.js';
import {scriptureAutosave} from './scripture-drafts.js';
const colorNames=['기본','회색','파랑','보라','빨강','초록','주황','갈색','노랑','분홍'];
const backgroundNames=['없음','회색','파랑','보라','빨강','초록','주황','갈색','노랑','분홍'];
const bindings=new WeakMap();
export async function bindBibleAnnotations(root,verses){
 const token=Symbol();bindings.set(root,token);
 const groups=[...new Map(verses.map(v=>[`${v.book}:${v.chapter}`,v])).values()];
 const results=await Promise.all(groups.map(v=>request('scripture/annotations?'+new URLSearchParams({book:v.book,chapter:v.chapter}))));if(!root.isConnected||bindings.get(root)!==token)return;
 const annotations=results.flatMap(result=>result.annotations);
 root.querySelectorAll('[data-annotation-index]').forEach(slot=>{
  const verse=verses[Number(slot.dataset.annotationIndex)];if(!verse)return;const prior=annotations.find(a=>a.book===verse.book&&a.chapter===verse.chapter&&a.verse===verse.verse);
  let revision=prior?.revision||0;const value={book:verse.book,chapter:verse.chapter,verse:verse.verse,color:prior?.color||'',background:prior?.background||'',memo:prior?.memo||''};
  slot.innerHTML=`<details class="bible-annotation"><summary aria-label="${esc(verse.book)} ${verse.chapter}:${verse.verse} 표시·메모">표시·메모<span data-annotation-preview></span></summary><div class="bible-annotation-fields"><label class="field">글자색<select data-annotation-color><option value="">기본</option>${documentColors.map((color,index)=>`<option value="${color}" ${color===value.color?'selected':''}>${colorNames[index]}</option>`).join('')}</select></label><label class="field">하이라이트<select data-annotation-background><option value="">없음</option>${documentBackgrounds.slice(1).map((color,index)=>`<option value="${color}" ${color===value.background?'selected':''}>${backgroundNames[index+1]}</option>`).join('')}</select></label><label class="field bible-annotation-memo">메모<textarea data-annotation-memo aria-label="${esc(verse.book)} ${verse.chapter}:${verse.verse} 메모" maxlength="20000">${esc(value.memo)}</textarea></label><span class="sub" data-annotation-status></span><button class="btn" data-scripture-save-retry hidden>저장 재시도</button></div></details>`;
  const target=slot.previousElementSibling?.querySelector('.scripture-verse-text')||slot.previousElementSibling;
  const draw=()=>{if(target){target.style.color=value.color;target.style.backgroundColor=value.background;}slot.querySelector('[data-annotation-preview]').textContent=value.memo?' · '+value.memo.slice(0,120):'';};
  const saver=scriptureAutosave({root:slot,status:slot.querySelector('[data-annotation-status]'),read:()=>value,save:async annotation=>{const result=await request('scripture/annotations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,annotation})});revision=result.annotation.revision;}});
  for(const [selector,key]of [['color','color'],['background','background'],['memo','memo']])slot.querySelector('[data-annotation-'+selector+']').addEventListener('input',event=>{value[key]=event.target.value;draw();saver.change();});draw();
 });
}
