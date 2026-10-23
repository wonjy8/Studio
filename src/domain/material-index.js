import {computeEngine} from '../compute/runtime.js';
import {colorLabels,brightnessLabels,validColorSummary} from './material-colors.js';
const aspectTerm=metadata=>{let a=metadata.width,b=metadata.height;if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<=0||b<=0)return '';while(b){const rest=a%b;a=b;b=rest;}return metadata.width/a+':'+metadata.height/a;};
// Generated search terms are separate from user-authored tags and descriptions.
export function materialSearchTerms(item){const metadata=item.metadata||{},orientation={landscape:'landscape horizontal 가로',portrait:'portrait vertical 세로',square:'square 정사각 정사각형'}[metadata.orientation]||'';return [item.fileName,item.mimeType,metadata.extension,aspectTerm(metadata),metadata.aspectRatio,metadata.width&&metadata.height?metadata.width+'x'+metadata.height:'',metadata.width&&metadata.height?metadata.width+'×'+metadata.height:'',orientation,validColorSummary(metadata.pixelSummary)?[...metadata.pixelSummary.colors.map(color=>colorLabels[color]),brightnessLabels[metadata.pixelSummary.brightness]].join(' '):'',item.searchText].filter(Boolean).join(' ');}
export function documentSearchText(document,limit=65536){let text='';for(const block of document?.blocks||[]){for(const run of block.content||[]){if(typeof run.text!=='string')continue;text+=(text?' ':'')+run.text.slice(0,limit-text.length);if(text.length>=limit)return text.slice(0,limit);}}return text;}
export function materialQueryTerms(query){const input=String(query||'').normalize('NFC').toLocaleLowerCase().trim();if(!input)return [];const terms=input.split(/\s+/);return input.length>1000||terms.length>32?null:terms;}
export function materialQueryText(item){return [item.title,item.previewTitle,item.description,item.previewDescription,item.category,item.source,item.url,materialSearchTerms(item),...(item.tags||[])].filter(Boolean).join(' ').normalize('NFC').toLocaleLowerCase();}
export function matchesMaterialQuery(item,query){const terms=materialQueryTerms(query);if(terms===null)return false;if(!terms.length)return true;const text=materialQueryText(item);return terms.every(term=>text.includes(term));}
// One index belongs to one mounted, authorized snapshot. Rebuild after refresh
// or mutation; never share or persist it across accounts or page instances.
export function createJsMaterialSearchIndex(items){let bytes=0;const rows=items.map(item=>{const text=materialQueryText(item);if(bytes+text.length*2>8*1024*1024)return {item,text:null};bytes+=text.length*2;return {item,text};});return query=>{const terms=materialQueryTerms(query);return terms===null?[]:rows.filter(row=>!terms.length||terms.every(term=>(row.text??materialQueryText(row.item)).includes(term))).map(row=>row.item);};}

export function createMaterialSearchIndex(items){
 if(!computeEngine){const search=createJsMaterialSearchIndex(items);search.dispose=()=>{};return search;}
 // Limit retained WASM text to 8MiB. Larger snapshots still use Rust, but
 // overflow chunks are encoded, searched and released one at a time.
 const chunks=[];let start=0,size=0,cached=0,disposed=false;
 const finish=end=>{if(end===start)return;const from=start,to=end;let index=null;
  if(cached+size<=8*1024*1024){index=computeEngine.index(items.slice(from,to).map(materialQueryText));cached+=size;}
  chunks.push({from,to,index});start=end;size=0;
 };
 for(let i=0;i<items.length;i++){const bytes=4+materialQueryText(items[i]).length*2;if(size&&size+bytes>2*1024*1024)finish(i);size+=bytes;}
 finish(items.length);
 const search=query=>{
  if(disposed)throw Error('검색 화면이 만료되었습니다.');
  const terms=materialQueryTerms(query);if(terms===null)return [];if(!terms.length)return [...items];
  const result=[];
  for(const chunk of chunks){const index=chunk.index||computeEngine.index(items.slice(chunk.from,chunk.to).map(materialQueryText));try{for(const i of index.search(terms))result.push(items[chunk.from+i]);}finally{if(!chunk.index)index.dispose();}}
  return result;
 };
 search.dispose=()=>{if(disposed)return;disposed=true;for(const chunk of chunks)chunk.index?.dispose();chunks.length=0;};return search;
}
