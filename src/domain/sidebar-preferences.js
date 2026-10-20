const groups=new Set(['rail','home','scripture','documents','equipment','materials','admin','settings','projects','shared']);
const validKey=value=>typeof value==='string'&&value.length>0&&value.length<=200;
export function normalizeSidebarPreferences(value){
 const orders={};if(value&&typeof value.orders==='object'&&value.orders)for(const [group,keys]of Object.entries(value.orders))if(groups.has(group)&&Array.isArray(keys))orders[group]=[...new Set(keys.filter(validKey))].slice(0,2000);
 return {version:1,collapsed:value?.collapsed===true,orders};
}
export function orderSidebarItems(items,saved=[],key=item=>item){
 const positions=new Map(saved.map((id,index)=>[id,index]));return [...items].sort((a,b)=>(positions.get(key(a))??Infinity)-(positions.get(key(b))??Infinity));
}
export function mergeSidebarOrder(saved,visible){
 const remaining=[...new Set(visible)],shown=new Set(remaining),result=[];let index=0;
 for(const key of saved||[]){if(shown.has(key)){if(index<remaining.length)result.push(remaining[index++]);}else if(!result.includes(key))result.push(key);}
 return [...new Set([...result,...remaining.slice(index)])];
}
