import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {icon} from '../design-system/primitives/icons.js';
import {layoutIcon} from '../design-system/primitives/layout-icons.js';
import {gearCategories} from '../domain/layout.js';

export function equipmentGroups(items,mode){
 const groups=new Map();
 for(const item of items){const key=mode==='counts'?`${item.category||'other'}:${(item.equipmentModel||item.name).trim().toLocaleLowerCase()}`:`${item.isRental?'rental':item.equipmentSource||'manual'}:${item.equipmentOwnerKey||item.ownerMemberId||item.owner||''}`;if(!groups.has(key))groups.set(key,{key,name:mode==='counts'?item.name:item.owner||'소유자 미지정',items:[]});groups.get(key).items.push(item);}
 return [...groups.values()].sort((a,b)=>mode==='owners'?Number(b.items[0].equipmentSource==='organization')-Number(a.items[0].equipmentSource==='organization'):0);
}
export const equipmentQuantity=item=>Number.isSafeInteger(item.equipmentQuantity)&&item.equipmentQuantity>0?item.equipmentQuantity:1;
const total=items=>items.reduce((sum,item)=>sum+equipmentQuantity(item),0);
const ready=item=>item.status==='ready'&&!item.equipmentUnavailable;
function row(item){return `<div class="gear-row equipment-item"><span class="equipment-kind" aria-hidden="true">${item.category==='lighting'?layoutIcon('lighting'):icon(item.category==='camera'?'camera':'gear')}</span><div class="equipment-item-label"><strong>${esc(item.name)}${equipmentQuantity(item)>1?` <span class="sub">× ${equipmentQuantity(item)}</span>`:''}</strong><span class="sub">${[gearCategories[item.category]||'기타',item.isRental?'대여처 '+item.owner:item.owner,item.equipmentUnavailable?'연결 해제됨':''].filter(Boolean).map(esc).join(' · ')}</span></div><button type="button" class="btn equipment-select ${ready(item)?'is-selected':''}" data-toggle-gear="${esc(item.id)}" aria-label="${esc(item.name)} ${ready(item)?'사용 취소':'사용 확정'}" aria-pressed="${ready(item)}" ${item.equipmentUnavailable?'disabled':''}>${ready(item)?'✓ 사용 확정':'사용 확정'}</button></div>`;}
export function projectEquipmentView(items,mode='owners',selection='',members=[],organizations=[]){
 mode=mode==='counts'?'counts':'owners';const groups=equipmentGroups(items,'owners');
 for(const org of organizations.filter(org=>org.connected))if(!groups.some(g=>g.items.some(item=>item.equipmentOwnerKey===org.id)))groups.unshift({key:'org:'+org.id,name:org.name,items:[]});
 for(const member of members)if(!groups.some(g=>g.items.some(item=>item.ownerMemberId===member.id||(member.accountId&&item.equipmentOwnerKey===member.accountId))))groups.push({key:'member:'+member.id,name:member.name,items:[]});
 if(mode==='counts'){groups.splice(0,groups.length,...[['ready','사용 확정',items.filter(ready)],['unused','미사용 장비',items.filter(item=>!ready(item))],['all','전체 장비',items]].map(([key,name,items])=>({key,name,items})));}
 const selected=groups.find(g=>g.key===selection)||groups[0],visible=selected?.items||[];
 const toolbar=`<div class="equipment-toolbar"><div class="equipment-view-switch" role="group" aria-label="장비 보기">${[['owners','멤버·조직별'],['counts','장비별 수량']].map(([key,label])=>`<button type="button" class="btn ${mode===key?'active':''}" data-equipment-view="${key}" aria-pressed="${mode===key}">${label}</button>`).join('')}</div><span class="sub">전체 ${total(items)}개 · 사용 확정 ${total(items.filter(ready))}개</span></div>`;
 const content=mode==='counts'?equipmentGroups(visible,'counts').map(group=>`<section class="equipment-group"><div class="section-head"><h2>${esc(group.name)}</h2><span class="equipment-count">${total(group.items)}개</span></div><div class="equipment-count-summary"><span class="sub">${esc(gearCategories[group.items[0].category]||'기타')}</span><strong>사용 확정 ${total(group.items.filter(ready))} / ${total(group.items)}</strong></div></section>`).join(''):visible.map(row).join('');
 return toolbar+`<div class="master-detail project-equipment-split"><aside class="master-list" aria-label="${mode==='counts'?'장비 사용 상태':'멤버·조직 목록'}">${groups.map(group=>`<button type="button" class="master-choice" data-equipment-owner="${esc(group.key)}" aria-pressed="${group===selected}"><strong>${esc(group.name)}</strong><span class="sub">${total(group.items)}개</span></button>`).join('')||'<p class="sub">등록된 멤버·조직이 없습니다.</p>'}</aside><section class="master-pane"><div class="section-head"><h2>${esc(selected?.name||'장비')}</h2><span class="equipment-count">${total(visible)}개</span></div>${content||'<div class="equipment-empty">등록된 장비가 없습니다.</div>'}</section></div>`;
}
