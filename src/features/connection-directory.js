import {googleNavigationState,readNavigationState,chatgptNavigationState} from './connection-navigation-state.js';
import {icon} from '../design-system/primitives/icons.js';
import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {request} from '../integrations/api.js';

export const connectionServices=[
 {id:'calendar',title:'Google Calendar'},
 {id:'tasks',title:'Google Tasks'},
 {id:'sheets',title:'Google Sheets'},
 {id:'docs',title:'Google Docs'},
 {id:'forms',title:'Google Forms'},
 {id:'chatgpt',title:'ChatGPT'}
];

// This directory only reads connection state. Opening a row never starts OAuth.
export function connectionDirectory(){
 return `<div class="connection-directory" data-connection-directory>${connectionServices.map(({id,title,shared})=>`<section class="connection-directory-item"><button type="button" class="connection-service-row connection-directory-entry" data-open-connection="${id}" data-connection-state="unknown" aria-label="${esc(title)} 연결 관리" aria-describedby="connection-summary-${id}" title="${esc(title)} 연결 관리"><span class="connection-service-logo" aria-hidden="true">${id==='chatgpt'?icon('tabler-brand-openai',{solid:true}):`<img src="/src/design-system/assets/google/${id}.svg" alt="" width="26" height="26">`}</span><span class="connection-service-identity"><strong>${esc(title)}</strong><span class="sub" id="connection-summary-${id}" data-connection-summary="${id}">${shared?'Google 공동 연결 · ':''}연결 확인 중…</span></span><span class="connection-service-add" aria-hidden="true">…</span></button><button type="button" class="btn connection-directory-retry" data-connection-retry="${id}" hidden>${esc(title)} 상태 다시 확인</button></section>`).join('')}</div>`;
}

export function bindConnectionDirectory(onOpen){
 const root=document.querySelector('[data-connection-directory]');if(!root)return;
 const sharedIds=['calendar','tasks','sheets'];
 const groupFor=id=>sharedIds.includes(id)?'google':id;
 const idsFor=group=>group==='google'?sharedIds:[group];
 const pending=new Set();
 const mark=(id,state)=>{if(!root.isConnected)return;const button=root.querySelector(`[data-open-connection="${id}"]`),name=connectionServices.find(item=>item.id===id).title;button.dataset.connectionState=state;button.querySelector('.connection-service-add').innerHTML=state==='connected'||state==='attention'?icon('chevron'):state==='unknown'?'…':icon('plus');const label=name+' 연결 관리 · '+({connected:'연결됨',attention:'확인 필요',disconnected:'연결 안 됨',unavailable:'서버 설정 필요',unknown:'상태 확인 필요'}[state]);button.setAttribute('aria-label',label);button.title=label;};
 const summary=(id,text)=>{if(root.isConnected)root.querySelector(`[data-connection-summary="${id}"]`).textContent=text;};
 root.querySelectorAll('[data-open-connection]').forEach(button=>button.onclick=()=>onOpen(button.dataset.openConnection));
 async function load(group){
  if(pending.has(group)||!root.isConnected)return;pending.add(group);
  const ids=idsFor(group);
  for(const id of ids)root.querySelector(`[data-connection-retry="${id}"]`).disabled=true;
  try{
   if(group==='google'){
    const status=await request('google/unified/status');
    if(!Array.isArray(status.services))throw Error('Invalid connection status');
    for(const id of ids){
     const service=status.services.find(item=>item.service===id);if(!service)throw Error('Invalid connection status');
     const state=service.connected?(service.email||'연결됨'):(status.configured?'연결 안 됨':'서버 설정 필요');
     const permission=service.latestGranted===false?' · 최근 동의 미허용'+(service.connected?' · 기존 연결 유지':''):service.connected&&service.permission!=='approved'?' · 권한 확인 필요':'';
     mark(id,googleNavigationState(service,status.configured));summary(id,state+permission+(!status.configured&&service.connected?' · 서버 설정 필요':'')+(service.error?' · '+service.error:''));
    }
   }else if(group==='chatgpt'){
    const data=await request('connections');if(!Array.isArray(data.connections))throw Error('Invalid connection status');
    const connection=chatgptNavigationState(data.connections);mark(group,connection.state);summary(group,connection.active?connection.active+'개 연결 · 권한별 관리'+(connection.expired?' · '+connection.expired+'개 만료·확인 필요':''):connection.expired?'만료·권한 확인 필요 · 다시 연결하세요.':'연결 안 됨');
   }else{
    const status=await request('google/read/'+group+'/status');
    mark(group,readNavigationState(status));summary(group,status.connected?(status.email||'연결됨')+(!status.configured?' · 서버 설정 필요':status.reconnectRequired?' · 다시 연결 필요':' · 읽기 권한 승인됨'):status.configured?'연결 안 됨 · 읽기 전용':'서버 설정 필요');
   }
   if(root.isConnected)for(const id of ids)root.querySelector(`[data-connection-retry="${id}"]`).hidden=true;
  }catch{
   if(root.isConnected)for(const id of ids){mark(id,'unknown');summary(id,'연결 상태 확인 실패 · 다시 확인해 주세요.'+(group==='google'?' · Calendar·Tasks·Sheets 공동 연결':''));root.querySelector(`[data-connection-retry="${id}"]`).hidden=false;}
  }finally{
   pending.delete(group);
   if(root.isConnected)for(const id of ids)root.querySelector(`[data-connection-retry="${id}"]`).disabled=false;
  }
 }
 root.querySelectorAll('[data-connection-retry]').forEach(button=>button.onclick=()=>void load(groupFor(button.dataset.connectionRetry)));
 for(const group of ['google','docs','forms','chatgpt'])void load(group);
}
