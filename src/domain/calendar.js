import {computeEngine} from '../compute/runtime.js';
export const pad=value=>String(value).padStart(2,'0');
export function dateKey(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);return y>=1000&&date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;}
export function dateObject(key){if(!validDate(key))throw Error('날짜를 확인해 주세요.');const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d,12);}
export function addDays(key,count){const date=dateObject(key);date.setDate(date.getDate()+count);return dateKey(date);}
export function shiftDate(key,mode,direction){const date=dateObject(key);if(mode==='year'){const month=date.getMonth(),day=date.getDate();date.setDate(1);date.setFullYear(date.getFullYear()+direction);date.setMonth(month);date.setDate(Math.min(day,new Date(date.getFullYear(),month+1,0).getDate()));return dateKey(date);}if(mode==='month'){const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+direction);const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();date.setDate(Math.min(day,last));return dateKey(date);}return addDays(key,direction*(mode==='week'?7:1));}
export function calendarDays(key,mode='month'){if(mode==='day')return [key];if(mode==='year'){const year=Number(key.slice(0,4)),first=year+'-01-01',last=(year+1)+'-01-01',days=[];for(let day=first;day<last;day=addDays(day,1))days.push(day);return days;}const date=dateObject(key);if(mode==='month')date.setDate(1);const first=addDays(dateKey(date),-date.getDay());const count=mode==='week'?7:Math.ceil((date.getDay()+new Date(date.getFullYear(),date.getMonth()+1,0).getDate())/7)*7;return Array.from({length:count},(_,i)=>addDays(first,i));}
export function minutes(value){const match=typeof value==='string'&&value.match(/^(\d{1,2}):(\d{2})$/);if(!match||+match[1]>23||+match[2]>59)return null;return +match[1]*60+(+match[2]);}
export function validSchedule(item){return (item.date===undefined||item.date===''||validDate(item.date))&&(item.time===undefined||item.time===''||(validDate(item.date)&&minutes(item.time)!==null));}
export function eventTime(value){const text=String(value||'').trim(),parts=text.split(/\s*[–—~\-]\s*/),start=minutes(parts[0]);if(start===null)return {start:null,end:null};const end=parts[1]==='24:00'?1440:minutes(parts[1]);return {start,end:end!==null&&end>start?end:Math.min(1440,start+60)};}
export function calendarEvents(state){return [...state.contents.map(c=>({id:c.id,type:'shoot',allDay:c.allDay===undefined?!c.time:c.allDay===true,name:c.name,date:c.date||state.project.date||'',time:c.time||'',completed:!!c.completed,...eventTime(c.time)})),...(state.tasks||[]).map(t=>({id:t.id,type:'task',allDay:t.allDay===undefined?!t.time:t.allDay===true,name:t.name,date:t.date||'',time:t.time||'',completed:t.completed,...eventTime(t.time)}))].sort((a,b)=>(a.start??-1)-(b.start??-1)||a.name.localeCompare(b.name));}
// Numeric geometry only: no account IDs, titles or cached event objects.
const laneCache=new Map();let cachedPoints=0;
function heapPush(heap,value,less){heap.push(value);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(!less(heap[i],heap[parent]))break;[heap[i],heap[parent]]=[heap[parent],heap[i]];i=parent;}}
function heapPop(heap,less){const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&less(heap[child+1],heap[child]))child++;if(!less(heap[child],heap[i]))break;[heap[i],heap[child]]=[heap[child],heap[i]];i=child;}}return first;}
const earliest=(a,b)=>a.end<b.end||a.end===b.end&&a.lane<b.lane,smallest=(a,b)=>a<b;
export function jsHeapEventLanes(events){
 const sorted=events.filter(e=>e.start!==null).map(e=>({...e})).sort((a,b)=>a.start-b.start||a.end-b.end);
 const key=JSON.stringify(sorted.map(e=>[e.start,e.end]));
 let geometry=laneCache.get(key);
 if(!geometry){
  geometry=[];const active=[],free=[];let groupStart=0,max=0,nextLane=0;
  const finish=()=>{for(let i=groupStart;i<geometry.length;i++)geometry[i].columns=max;groupStart=geometry.length;max=nextLane=0;free.length=0;};
  for(const event of sorted){
   while(active.length&&active[0].end<=event.start)heapPush(free,heapPop(active,earliest).lane,smallest);
   if(!active.length&&geometry.length>groupStart)finish();
   const lane=free.length?heapPop(free,smallest):nextLane++;
   heapPush(active,{end:Math.max(event.end,event.start+30),lane},earliest);
   geometry.push({lane,columns:0});max=Math.max(max,active.length);
  }
  finish();
  if(sorted.length&&sorted.length<=2048){while(laneCache.size>=32||cachedPoints+sorted.length>8192){const oldest=laneCache.keys().next().value;cachedPoints-=laneCache.get(oldest).length;laneCache.delete(oldest);}laneCache.set(key,geometry);cachedPoints+=sorted.length;}
 }
 return sorted.map((event,index)=>({...event,...geometry[index]}));
}

// Normal path: Rust owns stable sorting and heap allocation of overlap lanes.
const rustLaneCache=new Map();let rustCachedPoints=0;
export function eventLanes(events){
 if(!computeEngine)return jsHeapEventLanes(events);
 const timed=events.filter(event=>event.start!==null),key=JSON.stringify(timed.map(e=>[e.start,e.end]));
 let geometry=rustLaneCache.get(key);
 if(!geometry){geometry=computeEngine.lanes(timed);if(timed.length&&timed.length<=2048){while(rustLaneCache.size>=32||rustCachedPoints+timed.length>8192){const oldest=rustLaneCache.keys().next().value;rustCachedPoints-=rustLaneCache.get(oldest).length;rustLaneCache.delete(oldest);}rustLaneCache.set(key,geometry);rustCachedPoints+=timed.length;}}
 return geometry.map(({index,lane,columns})=>({...timed[index],lane,columns}));
}
