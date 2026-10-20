import {bibleBooks} from '../domain/bible.js';
// One ordered verse selection, shared by both translations. Verse identities are
// canonical book/chapter/verse addresses, never the translation's array indexes.
export const bibleVerseKey=verse=>JSON.stringify([verse.book,verse.chapter,verse.verse]);
export function extendBibleSelection(state,key,orderedKeys){
 const first=orderedKeys.indexOf(state.anchor),current=orderedKeys.indexOf(key);
 if(current<0)return state;
 const anchor=first<0?key:state.anchor,start=first<0?current:Math.min(first,current),end=first<0?current:Math.max(first,current);
 return {selected:new Set(orderedKeys.slice(start,end+1)),anchor};
}

export function bindBibleComparison(layout,state={selected:new Set(),anchor:null}){
 let frame=0,disposed=false;const moved=new Map();
 function restore(){for(const [row,{container,next}]of moved){if(container.isConnected)container.insertBefore(row,row.dataset.bibleRow?container.querySelector('.scripture-footnotes'):next?.parentNode===container?next:null);else row.remove();row.querySelector('[data-comparison-label]')?.remove();row.classList.remove('bible-secondary-verse');}moved.clear();}
 const clickSurface=layout.closest('main')||layout;
 const panels=new Map(),observer=new ResizeObserver(schedule),mobile=matchMedia('(max-width:760px)');
 const lifetime=new MutationObserver(()=>{if(!layout.isConnected)dispose();});lifetime.observe(document.body,{childList:true,subtree:true});
 function dispose(){clickSurface.removeEventListener('click',clearOnBlank);disposed=true;observer.disconnect();lifetime.disconnect();cancelAnimationFrame(frame);mobile.removeEventListener('change',schedule);}
 function schedule(){if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(align);}
 function align(){
  if(!layout.isConnected){dispose();return;}
  restore();
  const list=[...panels.keys()].filter(panel=>panel.isConnected);
  // Padding from a previous pairing must not survive version or viewport changes.
  const rows=list.flatMap(panel=>[...panel.querySelectorAll('[data-bible-row]')]);
  for(const row of rows){row.style.minHeight='';row.querySelector('.bible-row-heading').style.minHeight='';}
  for(const panel of list)panel.querySelector('[data-bible-verses]').style.paddingTop='';
  if(list.length!==2)return;
  if(mobile.matches){const secondaryLabel=list[1].querySelector('[data-bible-version]')?.selectedOptions[0]?.textContent||'대조 번역';const primary=list[0].querySelector('[data-bible-verses]'),tools=list[1].querySelector('.document-browse-tools');if(tools){moved.set(tools,{container:tools.parentNode,next:tools.nextSibling});tools.classList.add('bible-comparison-tools');primary.before(tools);}const secondary=list[1].querySelector('[data-bible-verses]'),rowsRight=new Map([...secondary.querySelectorAll('[data-bible-row]')].map(row=>[row.dataset.bibleRow,row]));for(const row of primary.querySelectorAll('[data-bible-row]')){const pair=rowsRight.get(row.dataset.bibleRow);if(!pair)continue;const label=document.createElement('span');label.className='bible-comparison-label';label.dataset.comparisonLabel='';label.textContent=secondaryLabel;pair.prepend(label);pair.classList.add('bible-secondary-verse');moved.set(pair,{container:secondary,next:pair.nextSibling});row.after(pair);}return;}
  const containers=list.map(panel=>panel.querySelector('[data-bible-verses]'));
  const top=Math.max(...containers.map(node=>node.getBoundingClientRect().top));
  for(const node of containers)node.style.paddingTop=(top-node.getBoundingClientRect().top)+'px';
  const grouped=new Map();for(const row of rows){const pair=grouped.get(row.dataset.bibleRow)||[];pair.push(row);grouped.set(row.dataset.bibleRow,pair);}
  const pairs=[...grouped.values()].filter(pair=>pair.length===2);
  // Batch layout reads before writes: long chapters do not force one reflow per verse.
  const headingSizes=pairs.map(pair=>Math.max(...pair.map(row=>row.querySelector('.bible-row-heading').getBoundingClientRect().height)));
  pairs.forEach((pair,index)=>pair.forEach(row=>{row.querySelector('.bible-row-heading').style.minHeight=headingSizes[index]+'px';}));
  const rowSizes=pairs.map(pair=>Math.max(...pair.map(row=>row.firstElementChild.getBoundingClientRect().height)));
  pairs.forEach((pair,index)=>pair.forEach(row=>{row.style.minHeight=rowSizes[index]+'px';}));
 }
 function update(){for(const panel of panels.keys()){
  for(const input of panel.querySelectorAll('[data-verse-key]'))input.checked=state.selected.has(input.dataset.verseKey);
  const rows=[...panel.querySelectorAll('[data-bible-row]')];rows.forEach((row,index)=>{const selected=state.selected.has(row.dataset.bibleRow);row.classList.toggle('is-selected',selected);row.classList.toggle('selection-start',selected&&!state.selected.has(rows[index-1]?.dataset.bibleRow));row.classList.toggle('selection-end',selected&&!state.selected.has(rows[index+1]?.dataset.bibleRow));});
 }}
 function clearOnBlank(event){
  if(event.target.closest('button,a,input,select,textarea,[contenteditable],.scripture-memo-mark,.scripture-verse-text,.scripture-scalable-text,.scripture-verse-number'))return;
  if(event.target.closest('.scripture-verse'))event.preventDefault();
  const selection=getSelection();if(selection&&!selection.isCollapsed)return;
  state.selected.clear();state.anchor=null;update();
 }
 clickSurface.addEventListener('click',clearOnBlank);
 // Canonical book/chapter/verse order also covers search results and addresses
 // omitted by one translation.
 function keys(){const all=new Map();for(const controller of panels.values())for(const verse of controller.verses())all.set(bibleVerseKey(verse),verse);return [...all].sort(([,a],[,b])=>bibleBooks.indexOf(a.book)-bibleBooks.indexOf(b.book)||a.chapter-b.chapter||a.verse-b.verse).map(([key])=>key);}
 function register(panel,controller){panels.set(panel,controller);return ()=>panels.delete(panel);}
 async function navigate(source){state.selected.clear();state.anchor=null;await Promise.all([...panels].filter(([panel])=>panel.isConnected).map(([,controller])=>controller.navigate(source)));}
 function rendered(panel){
  restore();
  // A translation may omit an address (or have no verses in this chapter).
  // Keep an explicit empty row rather than pairing different verse numbers.
  const orderedKeys=keys();
  for(const node of panels.keys()){
   const container=node.querySelector('[data-bible-verses]');if(!container)continue;
   container.querySelectorAll('[data-bible-placeholder]').forEach(row=>row.remove());
   const rows=new Map([...container.querySelectorAll('[data-bible-row]')].map(row=>[row.dataset.bibleRow,row]));
   const footer=container.querySelector('.scripture-footnotes');if(orderedKeys.length)for(const child of container.children)if(child.matches('p.sub'))child.remove();
   for(const key of orderedKeys){let row=rows.get(key);if(!row){row=document.createElement('div');row.className='bible-aligned-row';row.dataset.bibleRow=key;row.dataset.biblePlaceholder='';row.innerHTML=`<div class="bible-row-natural"><div class="bible-row-heading"></div><div class="scripture-verse"><span class="scripture-verse-number">${Number(JSON.parse(key)[2])}</span><span class="scripture-verse-text"><em class="bible-omitted">(black)</em></span></div></div>`;}container.insertBefore(row,footer);}
  }
  observer.disconnect();for(const [node]of panels){if(!node.isConnected){panels.delete(node);continue;}observer.observe(node.querySelector('.document-browse-tools'));observer.observe(node.querySelector('.scripture-chapter-heading'));for(const content of node.querySelectorAll('.bible-row-natural'))observer.observe(content);}
  panel.querySelectorAll('[data-verse-key]').forEach(input=>input.onchange=()=>{Object.assign(state,extendBibleSelection(state,input.dataset.verseKey,keys()));update();});update();schedule();
 }
 mobile.addEventListener('change',schedule);
 return {register,navigate,rendered,schedule,restore};
}
