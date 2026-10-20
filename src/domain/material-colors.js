// Pixel statistics, never object/scene inference. Shared browser/server vocabulary.
export const colorLabels={red:'빨강 빨간 빨간색 red',orange:'주황 주황색 orange',yellow:'노랑 노란 노란색 yellow',green:'초록 녹색 초록색 green',cyan:'청록 청록색 cyan',blue:'파랑 파란 파란색 blue',purple:'보라 보라색 purple',pink:'분홍 분홍색 pink',black:'검정 검은 검은색 black',white:'흰색 하양 흰 white',gray:'회색 gray grey'};
export const brightnessLabels={dark:'어두운 어두움 dark',medium:'중간밝기 medium',bright:'밝은 밝음 bright'};
export function summarizePixels(data){
 const counts={};let weight=0,luminance=0;
 for(let i=0;i<data.length;i+=4){const alpha=data[i+3]/255;if(alpha<0.1)continue;const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;let color;
 if(max<0.18)color='black';else if(delta<0.12)color=max>0.85?'white':'gray';else{let h=delta===0?0:max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;h=(h*60+360)%360;color=h<15||h>=345?'red':h<45?'orange':h<70?'yellow':h<165?'green':h<195?'cyan':h<255?'blue':h<290?'purple':'pink';}
 counts[color]=(counts[color]||0)+alpha;weight+=alpha;const linear=v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;luminance+=alpha*(0.2126*linear(r)+0.7152*linear(g)+0.0722*linear(b));
 }
 if(!weight)return null;const value=luminance/weight;return {colors:Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).filter(([,n])=>n/weight>=0.15).slice(0,3).map(([color])=>color),brightness:value<0.18?'dark':value>0.65?'bright':'medium'};
}
export function validColorSummary(value){return !!value&&Object.keys(value).length===2&&Array.isArray(value.colors)&&value.colors.length>0&&value.colors.length<=3&&new Set(value.colors).size===value.colors.length&&value.colors.every(color=>Object.hasOwn(colorLabels,color))&&Object.hasOwn(brightnessLabels,value.brightness);}
// Header preflight prevents decoding oversized images, including tiny compressed bombs.
export function boundedRaster(bytes,type){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let w=0,h=0;
 if(type==='image/png'&&bytes.length>=24&&bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'){w=v.getUint32(16);h=v.getUint32(20);}
 else if(type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){let p=2;while(p+4<=bytes.length){if(bytes[p++]!==255)return false;while(bytes[p]===255)p++;const m=bytes[p++];if(m===218||m===217)break;const n=v.getUint16(p);if(n<2||p+n>bytes.length)break;if([192,193,194].includes(m)&&n>=8){h=v.getUint16(p+3);w=v.getUint16(p+5);break;}p+=n;}}
 return w>0&&h>0&&w<=8192&&h<=8192&&w*h<=8000000;
}
export async function sampleUploadColors(file){
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024||typeof createImageBitmap!=='function'||typeof document==='undefined')return null;
 let bitmap;try{if(!boundedRaster(new Uint8Array(await file.slice(0,65536).arrayBuffer()),file.type))return null;bitmap=await createImageBitmap(file,{resizeWidth:64,resizeHeight:64,resizeQuality:'pixelated'});const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;context.drawImage(bitmap,0,0,64,64);return summarizePixels(context.getImageData(0,0,64,64).data);}catch{return null;}finally{bitmap?.close();}
}
