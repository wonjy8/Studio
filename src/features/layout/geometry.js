const edges=['n','ne','e','se','s','sw','w','nw'];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const radians=degrees=>(Number.isFinite(degrees)?degrees:0)*Math.PI/180;
export function layoutDefaults(item){return item.kind==='person'?{width:80,height:80,max:240,locked:true}:item.kind==='text'?{width:160,height:60,max:600,locked:false}:item.kind==='table'?{width:120,height:item.shape==='circle'?120:80,max:360,locked:item.shape==='circle'}:{width:96,height:80,max:360,locked:false};}
function footprint(width,height,rotation){const a=radians(rotation||0),c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return {width:width*c+height*s,height:width*s+height*c};}
function rotate(x,y,angle){const a=radians(angle),c=Math.cos(a),s=Math.sin(a);return {x:x*c-y*s,y:x*s+y*c};}
export function layoutItemGeometry(item,stageWidth,stageHeight){
 const resizable=['table','person','text'].includes(item.kind),defaults=layoutDefaults(item),padding=resizable?10:0;
 let width=resizable?(item.width??defaults.width):96,height=resizable?(item.height??defaults.height):80;
 if(resizable){const bounds=footprint(width,height,item.rotation),scale=Math.min(1,Math.max(1,stageWidth-padding*2)/bounds.width,Math.max(1,stageHeight-padding*2)/bounds.height);width=Math.max(48,width*scale);height=Math.max(48,height*scale);}
 const bounds=footprint(width,height,item.rotation),travelX=Math.max(0,stageWidth-bounds.width-padding*2),travelY=Math.max(0,stageHeight-bounds.height-padding*2);
 return {width,height,travelX,travelY,left:padding+bounds.width/2+travelX*item.x/100,top:padding+bounds.height/2+travelY*item.y/100,boundsWidth:bounds.width,boundsHeight:bounds.height};
}
// Deltas and pointer coordinates are canvas CSS pixels; screenScale is CSS display scale.
export function resizeLayoutGeometry(start,edge,dx,dy,stageWidth,stageHeight,{snap=true,screenScale=1,snapState=null}={}){
 if(!edges.includes(edge)||![dx,dy,stageWidth,stageHeight,screenScale].every(Number.isFinite)||screenScale<=0)throw Error('Invalid resize geometry');
 const defaults=layoutDefaults(start),unchanged={width:start.width??defaults.width,height:start.height??defaults.height,x:start.x,y:start.y};
 if((dx===0&&dy===0)||stageWidth<68||stageHeight<68)return {...unchanged,snapState:{width:false,height:false},snapped:false};
 const g=layoutItemGeometry(start,stageWidth,stageHeight),angle=start.rotation||0,delta=rotate(dx,dy,-angle),sx=edge.includes('e')?1:edge.includes('w')?-1:0,sy=edge.includes('s')?1:edge.includes('n')?-1:0;
 let width=g.width,height=g.height;
 if(defaults.locked){const changes=[...(sx?[delta.x*sx]:[]),...(sy?[delta.y*sy]:[])];width=height=clamp(g.width+changes.reduce((a,b)=>a+b,0)/changes.length,48,defaults.max);}
 else {if(sx)width=clamp(g.width+delta.x*sx,48,defaults.max);if(sy)height=clamp(g.height+delta.y*sy,48,defaults.max);}
 const nextSnap={width:false,height:false};
 const snapAxis=(value,target,key,active)=>{if(!snap||!active)return value;const threshold=snapState?.[key]?12:8;if(Math.abs(value-target)*screenScale<=threshold){nextSnap[key]=true;return target;}return value;};
 if(defaults.locked){width=height=snapAxis(width,defaults.width,'width',true);nextSnap.height=nextSnap.width;}
 else {width=snapAxis(width,defaults.width,'width',sx);height=snapAxis(height,defaults.height,'height',sy);}
 const opposite=rotate(-sx*g.width/2,-sy*g.height/2,angle),anchor={x:g.left+opposite.x,y:g.top+opposite.y};
 const candidate=(w,h)=>{const offset=rotate(sx*w/2,sy*h/2,angle);return {width:w,height:h,left:anchor.x+offset.x,top:anchor.y+offset.y};};
 const fits=next=>{const bounds=footprint(next.width,next.height,angle);return next.left-bounds.width/2>=10-1e-10&&next.left+bounds.width/2<=stageWidth-10+1e-10&&next.top-bounds.height/2>=10-1e-10&&next.top+bounds.height/2<=stageHeight-10+1e-10;};
 let next=candidate(width,height);
 if(!fits(next)){if(!fits(candidate(g.width,g.height)))return {...unchanged,snapState:{width:false,height:false},snapped:false};let lo=0,hi=1;for(let i=0;i<52;i++){const mid=(lo+hi)/2;if(fits(candidate(g.width+(width-g.width)*mid,g.height+(height-g.height)*mid)))lo=mid;else hi=mid;}next=candidate(g.width+(width-g.width)*lo,g.height+(height-g.height)*lo);if(Math.abs(next.width-width)>1e-7)nextSnap.width=false;if(Math.abs(next.height-height)>1e-7)nextSnap.height=false;}
 next=candidate(clamp(next.width,48,defaults.max),clamp(next.height,48,defaults.max));
 const bounds=footprint(next.width,next.height,angle),position=(center,size,extent,original)=>{const travel=extent-size-20;return travel>1e-8?clamp((center-10-size/2)/travel*100,0,100):original;};
 const same=Math.abs(next.width-g.width)<1e-9&&Math.abs(next.height-g.height)<1e-9;
 return {width:next.width,height:next.height,x:same?start.x:position(next.left,bounds.width,stageWidth,start.x),y:same?start.y:position(next.top,bounds.height,stageHeight,start.y),snapState:nextSnap,snapped:nextSnap.width||nextSnap.height};
}
export function rotateLayoutGeometry(start,pointerStart,pointerNow,stageWidth,stageHeight,{shiftKey=false}={}){
 if(![pointerStart?.x,pointerStart?.y,pointerNow?.x,pointerNow?.y,stageWidth,stageHeight].every(Number.isFinite))throw Error('Invalid rotation geometry');
 const g=layoutItemGeometry(start,stageWidth,stageHeight),a=Math.atan2(pointerStart.y-g.top,pointerStart.x-g.left),b=Math.atan2(pointerNow.y-g.top,pointerNow.x-g.left);
 let angle=(start.rotation||0)+(b-a)*180/Math.PI;if(shiftKey)angle=Math.round(angle/45)*45;return ((angle%360)+360)%360;
}
// Keep the visual center stable during rotation, except where canvas bounds require clamping.
export function layoutRotationPosition(start,rotation,stageWidth,stageHeight){
 if(!Number.isFinite(rotation))throw Error('Invalid rotation geometry');
 const angle=((rotation%360)+360)%360,old=layoutItemGeometry(start,stageWidth,stageHeight),next=layoutItemGeometry({...start,rotation:angle},stageWidth,stageHeight),padding=['table','person','text'].includes(start.kind)?10:0;
 const coordinate=(center,size,travel,original)=>travel>1e-8?clamp((center-padding-size/2)/travel*100,0,100):original;
 return {rotation:angle,x:coordinate(old.left,next.boundsWidth,next.travelX,start.x),y:coordinate(old.top,next.boundsHeight,next.travelY,start.y)};
}
