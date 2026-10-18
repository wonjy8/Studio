import {escapeHtml as esc} from '../design-system/primitives/html.js';
import {icon} from '../design-system/primitives/icons.js';
import {layoutIcon} from '../design-system/primitives/layout-icons.js';
import {gearCategories} from '../domain/layout.js';

export function equipmentGroups(items,mode){
 const groups=new Map();
 for(const item of items){const key=mode==='counts'?`${item.category||'other'}:${(item.equipmentModel||item.name).trim().toLocaleLowerCase()}`:`${item.equipmentSource||'manual'}:${item.equipmentOwnerKey||item.ownerMemberId||item.owner||''}`;if(!groups.has(key))groups.set(key,{name:mode==='counts'?item.name:item.owner||'소유자 미지정',items:[]});groups.get(key).items.push(item);}
 return [...groups.values()].sort((a,b)=>mode==='owners'?Number(b.items[0].equipmentSource==='organization')-Number(a.items[0].equipmentSource==='organization'):0);
}
export const equipmentQuantity=item=>Number.isSafeInteger(item.equipmentQuantity)&&item.equipmentQuantity>0?item.equipmentQuantity:1;
const total=items=>items.reduce((sum,item)=>sum+equipmentQuantity(item),0);
const ready=item=>item.status==='ready'&&!item.equipmentUnavailable;
function row(item){return `<div class="gear-row equipment-item"><span class="equipment-kind" aria-hidden="true">${item.category==='lighting'?layoutIcon('lighting'):icon(item.category==='camera'?'camera':'gear')}</span><div class="equipment-item-label"><strong>${esc(item.name)}${equipmentQuantity(item)>1?` <span class="sub">× ${equipmentQuantity(item)}</span>`:''}</strong><span class="sub">${[gearCategories[item.category]||'기타',item.owner,item.equipmentUnavailable?'연결 해제됨':''].filter(Boolean).map(esc).join(' · ')}</span></div><button type="button" class="btn equipment-select ${ready(item)?'is-selected':''}" data-toggle-gear="${esc(item.id)}" aria-label="${esc(item.name)} ${ready(item)?'사용 취소':'사용 확정'}" aria-pressed="${ready(item)}" ${item.equipmentUnavailable?'disabled':''}>${ready(item)?'✓ 사용 확정':'사용 선택'}</button></div>`;}
export function projectEquipmentView(items,mode='owners'){
 const selected=items.filter(ready),pending=items.filter(item=>!ready(item));
 const toolbar=`<div class="equipment-toolbar"><div class="equipment-view-switch" role="group" aria-label="장비 보기">${[['owners','멤버·조직별'],['counts','장비별 수량'],['selection','사용 선택']].map(([key,label])=>`<button type="button" class="btn ${mode===key?'active':''}" data-equipment-view="${key}" aria-pressed="${mode===key}">${label}</button>`).join('')}</div><span class="sub">전체 ${total(items)}개 · 사용 확정 ${total(selected)}개</span></div>`;
 let content;
 if(mode==='selection')content=`<div class="equipment-selection-grid">${[[pending,'미확정'],[selected,'사용 확정']].map(([list,label])=>`<section class="equipment-pane"><div class="section-head"><h2>${label}</h2><span class="equipment-count">${list.length}</span></div>${list.map(row).join('')||'<div class="equipment-empty">장비가 없습니다.</div>'}</section>`).join('')}</div>`;
 else content=equipmentGroups(items,mode).map(group=>`<section class="equipment-group"><div class="section-head"><h2>${esc(group.name)}</h2><span class="equipment-count">${total(group.items)}개</span></div>${mode==='counts'?`<div class="equipment-count-summary"><span class="sub">${esc(gearCategories[group.items[0].category]||'기타')}</span><strong>사용 확정 ${total(group.items.filter(ready))} / ${total(group.items)}</strong></div>`:group.items.map(row).join('')}</section>`).join('')||'<div class="equipment-empty">등록된 장비가 없습니다.</div>';
 return toolbar+content;
}
