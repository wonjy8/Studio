export const gearCategories={camera:'카메라',lens:'렌즈',lighting:'조명',tripod:'삼각대',sd:'SD 카드',audio:'음향',other:'기타 장비'};
export const layoutKinds={person:'사람',table:'테이블',chair:'의자',stage:'무대',equipment:'장비',other:'기타 사물'};
export function prepareLayout(project){
 project.layoutObjects ||= [];
 for(const camera of project.cameras){
  if(camera.gearId)continue;
  let gear=project.gear.find(g=>(g.category===undefined||g.category==='camera')&&(g.name===camera.body||g.name===camera.name));
  if(!gear){gear={id:'g-'+crypto.randomUUID(),name:camera.body||camera.name,category:'camera',owner:'',assignee:camera.operator,status:'check'};project.gear.push(gear);}
  gear.category='camera';camera.gearId=gear.id;
 }
 return project;
}
function nextPosition(project){
 const items=[...project.cameras,...(project.layoutObjects||[])];
 for(const y of [20,50,80])for(const x of [15,50,85])if(!items.some(item=>Math.abs(item.x-x)<18&&Math.abs(item.y-y)<20))return {x,y};
 return {x:50,y:50};
}
export function addCamera(project,fields){
 const existing=fields.gearId&&project.gear.find(g=>g.id===fields.gearId&&g.category==='camera');
 if(fields.gearId&&!existing)throw Error('카메라 장비를 선택해 주세요.');
 if(!fields.name?.trim())throw Error('카메라 이름을 입력해 주세요.');
 if(project.cameras.length>=2000||(!existing&&project.gear.length>=2000))throw Error('카메라 또는 장비 개수 제한에 도달했습니다.');
 const gear=existing||{id:'g-'+crypto.randomUUID(),name:fields.body||fields.name,category:'camera',owner:'',assignee:fields.operator||'',status:'check'};
 if(!existing)project.gear.push(gear);
 const camera={id:'cam-'+crypto.randomUUID(),name:fields.name.trim(),role:fields.role||'',operator:fields.operator||'',body:gear.name,lens:fields.lens||'',gearId:gear.id,...nextPosition(project),refs:fields.ref?[fields.ref]:[]};
 project.cameras.push(camera);return camera;
}
export function addLayoutObject(project,{kind,name,gearId,memberId,shape}){
 if(!Object.hasOwn(layoutKinds,kind))throw Error('배치할 종류를 선택해 주세요.');
 if(project.layoutObjects.length>=2000)throw Error('배치 개수 제한에 도달했습니다.');
 const gear=kind==='equipment'&&project.gear.find(g=>g.id===gearId);
 const member=kind==='person'&&memberId&&project.members.find(m=>m.id===memberId);
 if(kind==='equipment'&&!gear)throw Error('먼저 장비 탭에서 장비를 등록해 주세요.');
 if(kind==='person'&&memberId&&!member)throw Error('멤버를 선택해 주세요.');
 const label=(name?.trim()||gear?.name||member?.name||(kind==='person'?'':layoutKinds[kind])).trim();
 if(!label||label.length>2000)throw Error('이름을 확인해 주세요.');
 if(kind==='table'&&shape!==undefined&&!['rectangle','circle'].includes(shape))throw Error('테이블 모양을 선택해 주세요.');
 const item={id:'obj-'+crypto.randomUUID(),kind,name:label,...nextPosition(project),rotation:0,...(kind==='table'?{shape:shape||'rectangle',width:120,height:shape==='circle'?120:80}:{}),...(gear?{gearId:gear.id}:{}),...(member?{memberId:member.id}:{})};
 project.layoutObjects.push(item);return item;
}
export function moveLayoutItem(project,id,x,y,rotation){
 const item=[...project.cameras,...project.layoutObjects].find(x=>x.id===id);
 if(!item||![x,y].every(Number.isFinite)||(rotation!==undefined&&!Number.isFinite(rotation)))throw Error('배치 좌표를 확인해 주세요.');
 item.x=Math.max(0,Math.min(100,x));item.y=Math.max(0,Math.min(100,y));
 if(rotation!==undefined&&item.kind)item.rotation=Math.max(0,Math.min(360,rotation));
 return item;
}
export function removeLayoutItem(project,id){
 project.layoutObjects=project.layoutObjects.filter(x=>x.id!==id);
 project.cameras=project.cameras.filter(x=>x.id!==id);
 // Removing a placement never removes its reusable inventory or member record.
}

export function validTableGeometry(item){
 if(item.kind!=='table')return item.shape===undefined&&item.width===undefined&&item.height===undefined;
 if(item.shape!==undefined&&!['rectangle','circle'].includes(item.shape))return false;
 if(!['width','height'].every(key=>item[key]===undefined||(Number.isFinite(item[key])&&item[key]>=48&&item[key]<=360)))return false;
 return item.shape!=='circle'||(item.width??120)===(item.height??120);
}
export function resizeLayoutTable(project,id,width,height,shape){
 const item=project.layoutObjects.find(x=>x.id===id&&x.kind==='table');
 if(!item||![width,height].every(Number.isFinite)||(shape!==undefined&&!['rectangle','circle'].includes(shape)))throw Error('테이블 크기를 확인해 주세요.');
 if(shape!==undefined)item.shape=shape;
 item.width=Math.max(48,Math.min(360,width));item.height=item.shape==='circle'?item.width:Math.max(48,Math.min(360,height));
 return item;
}
