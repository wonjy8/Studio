import {parseBiblePassage} from '../src/domain/bible.js';
import {validDate} from '../src/domain/calendar.js';
const origin='https://sum.su.or.kr:8888';
export const dailyQtUrl=date=>origin+'/bible/today?base_de='+date;
const fail=message=>Object.assign(Error(message),{status:502});
function plain(value){return String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?\s*>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,decimal)=>{const code=parseInt(hex||decimal,hex?16:10);return code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').trim();}
// The provider's date-bearing JSON, never a guessed date attached to an HTML page.
export function parseDailyQt(content,verses,date){
 if(!validDate(date)||!content||content.Base_de!==date)throw fail('매일성경 응답의 날짜를 확인하지 못했습니다. 원문을 확인해 주세요.');
 const title=plain(content.Qt_sj),passage=(plain(content.Bible_name).replace(/\([^)]*\)/g,'').trim()+' '+plain(content.Bible_chapter)).trim();
 if(!title||title.length>200||!parseBiblePassage(passage)||!Array.isArray(verses)||!verses.length||verses.length>500)throw fail('매일성경 제목이나 본문 범위를 찾지 못했습니다. 원문을 확인해 주세요.');
 const texts=verses.map(verse=>({label:plain(verse.Verse).slice(0,20),text:plain(verse.Bible_Cn)}));if(texts.some(v=>!v.text||v.text.length>8000)||texts.reduce((n,v)=>n+v.text.length,0)>200000)throw fail('매일성경 본문을 확인하지 못했습니다.');const commentary=[];
 if(content.Qt_Brf)commentary.push({title:'본문 요약',text:plain(content.Qt_Brf)});
 for(let i=1;i<=4;i++)if(content['Qt_a'+i])commentary.push({title:plain(content['Qt_q'+i+'_str'])||'묵상',text:plain(content['Qt_a'+i])});if(commentary.some(c=>c.text.length>50000))throw fail('매일성경 해설이 너무 큽니다.');
 return {date,passage,title,url:dailyQtUrl(date),provider:'성서유니온 매일성경',verses:texts,commentary};
}
export function dailyQtService({fetcher=fetch}={}){
 const cache=new Map(),inflight=new Map();
 async function remote(url,options={}){const response=await fetcher(url,{...options,signal:AbortSignal.timeout(12000),redirect:'manual',headers:{Accept:'application/json,text/html','User-Agent':'Studio-Scripture/1.0',...options.headers}});if(!response.ok)throw fail('매일성경을 불러오지 못했습니다. 잠시 후 다시 시도하세요.');if(Number(response.headers.get('content-length'))>2*1024*1024)throw fail('매일성경 응답이 너무 큽니다.');const reader=response.body?.getReader();if(!reader)throw fail('매일성경 응답이 비어 있습니다.');const chunks=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw fail('매일성경 응답이 너무 큽니다.');}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return {response,text:new TextDecoder('utf-8').decode(bytes)};}
 return {async get(date){
  if(!validDate(date))throw Object.assign(Error('올바른 날짜를 선택하세요.'),{status:400});if(cache.has(date))return cache.get(date);if(inflight.has(date))return inflight.get(date);
  const job=Promise.resolve().then(async()=>{try{const session=await remote(origin+'/bible/today'),cookies=(session.response.headers.getSetCookie?.()||[]).map(value=>value.split(';')[0]).join('; ');
   const post=async(endpoint,data)=>{const result=await remote(origin+'/Ajax/Bible/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','X-Requested-With':'XMLHttpRequest',Referer:origin+'/bible/today',...(cookies?{Cookie:cookies}:{})},body:JSON.stringify(data)});try{return JSON.parse(result.text);}catch{throw fail('매일성경 JSON 응답을 읽지 못했습니다.');}};
   const [content,verses]=await Promise.all([post('BodyBibleCont',{qt_ty:'QT1',Base_de:date,Bibletype:'1'}),post('BodyBible',{qt_ty:'QT1',Base_de:date})]),reading=parseDailyQt(content,verses,date);cache.set(date,reading);if(cache.size>90)cache.delete(cache.keys().next().value);return reading;
  }catch(error){if(error.status)throw error;throw fail('매일성경 자동 조회에 실패했습니다. 원문을 확인하거나 다시 시도하세요.');}finally{inflight.delete(date);}});inflight.set(date,job);return job;
 }};
}
