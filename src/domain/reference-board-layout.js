// Flat module registry and non-nesting flow keep every node addressable exactly once.
export const moduleWidth=value=>Math.max(20,Math.min(100,Number.isFinite(Number(value))?Number(value):100));
export function migrateBoard(items,layout){
 if(layout?.version===2){const next=structuredClone(layout),known=new Set(items.map(item=>item.key));for(const module of next.modules)module.items=module.items.filter(key=>known.has(key));return normalizeBoard(next);}
 const ordered=[...items].sort((a,b)=>(a.y||0)-(b.y||0)||(a.x||0)-(b.x||0));
 const modules=ordered.map((item,index)=>({id:'legacy-'+index,title:item.title||'',width:moduleWidth((item.w||12)/12*100),items:[item.key]})),flow=[];
 for(let index=0;index<ordered.length;){let end=index+1;while(end<ordered.length&&ordered[end].y===ordered[index].y)end++;const row=ordered.slice(index,end),aligned=row.length>=2&&row.length<=4&&row.every((item,i)=>Number.isInteger(item.x)&&Number.isInteger(item.w)&&item.w>=2&&item.x>=0&&item.x+item.w<=12&&(!i||item.x>=row[i-1].x+row[i-1].w));
  if(aligned){const total=row.reduce((sum,item)=>sum+item.w,0);flow.push({type:'columns',id:'legacy-columns-'+index,columns:row.map((item,i)=>{modules[index+i].width=100;return {width:item.w/total,modules:[modules[index+i].id]};})});}else for(let i=index;i<end;i++)flow.push({type:'module',id:modules[i].id});index=end;
 }
 return {version:2,modules,flow};
}
export function normalizeBoard(layout){
 const ids=new Set(layout.modules.map(m=>m.id));
 layout.flow=layout.flow.flatMap(node=>{
  if(node.type==='module')return ids.has(node.id)?[node]:[];
  const columns=node.columns.map(column=>({...column,modules:column.modules.filter(id=>ids.has(id))})).filter(column=>column.modules.length);
  if(!columns.length)return [];
  if(columns.length===1)return columns[0].modules.map(id=>({type:'module',id}));
  const sum=columns.reduce((n,c)=>n+c.width,0),needsFloor=columns.some(c=>c.width/sum<.05);return [{...node,columns:columns.map(c=>({...c,width:needsFloor?.05+c.width/sum*(1-.05*columns.length):c.width/sum}))}];
 });return layout;
}
export function validateBoardLayout(layout,keys){
 if(!layout||layout.version!==2||!Array.isArray(layout.modules)||layout.modules.length>150||!Array.isArray(layout.flow)||layout.flow.length>150)throw Error('Invalid module layout');
 const ids=new Set(),used=new Set(),known=new Set(keys);
 const modules=layout.modules.map(m=>{
  if(!m||typeof m.id!=='string'||!/^[-\w]{1,100}$/.test(m.id)||ids.has(m.id)||typeof m.title!=='string'||m.title.length>200||!Number.isFinite(m.width)||m.width<20||m.width>100||!Array.isArray(m.items))throw Error('Invalid module');
  ids.add(m.id);for(const key of m.items){if(!known.has(key)||used.has(key))throw Error('Duplicate or unknown module item');used.add(key);}return {id:m.id,title:m.title,width:m.width,items:[...m.items]};
 });
 const placed=new Set(),containers=new Set();const take=id=>{if(!ids.has(id)||placed.has(id))throw Error('Duplicate or unknown module');placed.add(id);return id;};
 const flow=layout.flow.map(node=>{
  if(node.type==='module')return {type:'module',id:take(node.id)};
  if(node.type!=='columns'||typeof node.id!=='string'||!/^[-\w]{1,100}$/.test(node.id)||containers.has(node.id)||ids.has(node.id)||!Array.isArray(node.columns)||node.columns.length<2||node.columns.length>4)throw Error('Invalid columns');containers.add(node.id);
  return {type:'columns',id:node.id,columns:node.columns.map(c=>{if(!Number.isFinite(c.width)||c.width<.05||c.width>1||!Array.isArray(c.modules))throw Error('Invalid column width');return {width:c.width,modules:c.modules.map(take)};})};
 });
 if(placed.size!==ids.size)throw Error('Unplaced module');return normalizeBoard({version:2,modules,flow});
}
export function detachModule(layout,id){layout.flow=layout.flow.filter(n=>n.type!=='module'||n.id!==id);for(const n of layout.flow)if(n.type==='columns')for(const c of n.columns)c.modules=c.modules.filter(key=>key!==id);}
export function moveModule(layout,id,targetId,side='before'){
 if(id===targetId)return layout;const target=layout.flow.find(n=>n.id===targetId||(n.type==='columns'&&n.columns.some(c=>c.modules.includes(targetId))));
 if(!target||!layout.modules.some(m=>m.id===id))return layout;
 if(side==='right'&&target.type==='columns'&&target.columns.length===4&&!target.columns.some(c=>c.modules.length===1&&c.modules[0]===id))return layout;
 const destinationColumn=target.type==='columns'?target.columns.find(c=>c.modules.includes(targetId)):null;
 detachModule(layout,id);
 if(destinationColumn&&['inside-before','inside-after'].includes(side)){const index=destinationColumn.modules.indexOf(targetId);destinationColumn.modules.splice(index+(side==='inside-after'?1:0),0,id);return normalizeBoard(layout);}
 if(side==='right'){
  if(target.type==='columns'){target.columns=target.columns.filter(c=>c.modules.length);const index=target.columns.findIndex(c=>c.modules.includes(targetId)),remaining=1-1/(target.columns.length+1),sum=target.columns.reduce((n,c)=>n+c.width,0);for(const c of target.columns)c.width=.05+c.width/sum*(remaining-.05*target.columns.length);target.columns.splice(index+1,0,{width:1/(target.columns.length+1),modules:[id]});}
  else{const index=layout.flow.indexOf(target);const baseId='columns-'+id.slice(0,80);let containerId=baseId,suffix=0;while(layout.flow.some(n=>n.id===containerId)||layout.modules.some(m=>m.id===containerId))containerId=baseId+'-'+(++suffix);layout.flow.splice(index,1,{type:'columns',id:containerId,columns:[{width:.5,modules:[target.id]},{width:.5,modules:[id]}]});}
 }else{const index=layout.flow.indexOf(target);layout.flow.splice(index+(side==='after'?1:0),0,{type:'module',id});}
 return normalizeBoard(layout);
}
export function moveBoardItem(layout,key,targetId,beforeKey){if(key===beforeKey)return layout;const target=layout.modules.find(m=>m.id===targetId);if(!target)return layout;for(const m of layout.modules)m.items=m.items.filter(k=>k!==key);const index=target.items.indexOf(beforeKey);target.items.splice(index<0?target.items.length:index,0,key);return layout;}
export function removeBoardModule(layout,id){layout.modules=layout.modules.filter(m=>m.id!==id);detachModule(layout,id);return normalizeBoard(layout);}
