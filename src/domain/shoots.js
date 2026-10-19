// Additive shoot configuration. Registered stock stays canonical; rentals and layout belong to this shoot only.
export const emptyShootConfiguration=()=>({memberIds:[],gearIds:[],rentals:[],cameras:[],layoutObjects:[]});
const id=prefix=>prefix+'-'+crypto.randomUUID();
export function shootConfiguration(project,shoot){
 if(shoot.configuration)return structuredClone(shoot.configuration);
 return pruneShootLayout(project,{memberIds:project.members.map(m=>m.id),gearIds:project.gear.filter(g=>!g.equipmentUnavailable).map(g=>g.id),rentals:[],cameras:structuredClone(project.cameras),layoutObjects:structuredClone(project.layoutObjects||[])});
}
export function shootLayout(project,configuration){return {...project,members:project.members.filter(m=>configuration.memberIds.includes(m.id)),gear:[...project.gear.filter(g=>configuration.gearIds.includes(g.id)&&!g.equipmentUnavailable),...configuration.rentals],cameras:configuration.cameras,layoutObjects:configuration.layoutObjects};}
export function pruneShootLayout(project,configuration){
 const next=structuredClone(configuration),scope=shootLayout(project,next),gearIds=new Set(scope.gear.map(g=>g.id)),members=new Set(scope.members.map(m=>m.id));
 next.cameras=next.cameras.filter(c=>!c.gearId||gearIds.has(c.gearId));next.layoutObjects=next.layoutObjects.filter(o=>(!o.gearId||gearIds.has(o.gearId))&&(!o.memberId||members.has(o.memberId)));return next;
}
export function copyShoot(project,shootId){
 if(project.contents.length>=2000)throw Error('촬영은 최대 2000개입니다.');
 const source=project.contents.find(s=>s.id===shootId);if(!source)throw Error('촬영을 찾을 수 없습니다.');
 const tasks=(project.tasks||[]).filter(t=>t.shootId===shootId);if((project.tasks||[]).length+tasks.length>2000)throw Error('할 일은 최대 2000개입니다.');
 const configuration=shootConfiguration(project,source),rentalIds=new Map();
 // Legacy project rentals become independent shoot-only plans in the copy.
 const legacyRentals=project.gear.filter(g=>g.isRental&&configuration.gearIds.includes(g.id));configuration.rentals.push(...legacyRentals);configuration.gearIds=configuration.gearIds.filter(gearId=>!legacyRentals.some(g=>g.id===gearId));
 configuration.rentals=configuration.rentals.map(rental=>{const nextId=id('rental');rentalIds.set(rental.id,nextId);return {id:nextId,name:rental.name,category:rental.category||'other',owner:rental.owner||'',assignee:'',status:'check',isRental:true,quantity:rental.quantity||rental.equipmentQuantity||1,...(rental.catalogModelId?{catalogModelId:rental.catalogModelId}:{})};});
 for(const entry of [...configuration.cameras,...configuration.layoutObjects]){entry.id=id('layout');if(rentalIds.has(entry.gearId))entry.gearId=rentalIds.get(entry.gearId);}
 const copy={...structuredClone(source),id:id('shoot'),name:source.name.slice(0,1995)+' (복사)',completed:false,status:'check',configuration};
 const next=structuredClone(project);next.contents.push(copy);next.schedule.push([copy.time,copy.name,copy.id]);next.tasks||=[];next.tasks.push(...tasks.map(task=>({...structuredClone(task),id:id('task'),shootId:copy.id,completed:false})));return {project:next,shoot:copy};
}
