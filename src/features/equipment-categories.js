import {gearCategories} from '../domain/layout.js';
export function equipmentCategory(value){const key=Object.hasOwn(gearCategories,value)?value:'other';return {key,label:gearCategories[key],order:Object.keys(gearCategories).indexOf(key)};}
export function groupEquipmentByCategory(items){const groups=new Map();for(const item of items){const category=equipmentCategory(item.category);if(!groups.has(category.key))groups.set(category.key,{...category,items:[]});groups.get(category.key).items.push(item);}return [...groups.values()].sort((a,b)=>a.order-b.order);}
