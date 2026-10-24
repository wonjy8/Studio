// Only the finite JSON Schema keywords used by Studio's static tool registry.
// This is input-shape validation; resource/ownership checks remain in the services.
export function toolArgumentError(value,spec,path='arguments'){
 const type=value===null?'null':Array.isArray(value)?'array':typeof value;
 const types=Array.isArray(spec.type)?spec.type:[spec.type];
 if(!types.some(t=>t==='integer'?Number.isSafeInteger(value):t==='number'?typeof value==='number'&&Number.isFinite(value):t===type))return path+' has an invalid type';
 if(spec.enum&&!spec.enum.includes(value))return path+' is not an allowed value';
 if(type==='string'&&spec.maxLength!==undefined&&Array.from(value).length>spec.maxLength)return path+' exceeds its length limit';
 if(type==='number'&&(spec.minimum!==undefined&&value<spec.minimum||spec.maximum!==undefined&&value>spec.maximum))return path+' is outside its allowed range';
 if(type==='array'){
  if(spec.minItems!==undefined&&value.length<spec.minItems||spec.maxItems!==undefined&&value.length>spec.maxItems)return path+' has an invalid item count';
  for(let i=0;i<value.length;i++){const error=toolArgumentError(value[i],spec.items,path+'['+i+']');if(error)return error;}
 }
 if(type==='object'){
  for(const key of spec.required||[])if(!Object.hasOwn(value,key))return path+'.'+key+' is required';
  for(const key of Object.keys(value)){
   // Never echo unknown caller-controlled keys or values into diagnostics.
   if(!Object.hasOwn(spec.properties,key)){if(spec.additionalProperties===false)return path+' contains an unsupported field';continue;}
   const error=toolArgumentError(value[key],spec.properties[key],path+'.'+key);if(error)return error;
  }
 }
 return null;
}
export const projectPageSchema={offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}};
export function projectPage(items,{offset=0,limit=50}={}){
 return {items:items.slice(offset,offset+limit),total:items.length,offset,limit,nextOffset:offset+limit<items.length?offset+limit:null};
}
export const maxReadResultBytes=1024*1024;
export function toolResult(value,{bounded=false}={}){
 const payload={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};
 if(bounded&&Buffer.byteLength(JSON.stringify(payload),'utf8')>maxReadResultBytes)throw Object.assign(Error('Read result exceeds 1 MiB. Use a smaller page or an approved field-specific studio_read_content request; large projects can also be viewed in Studio.'),{code:'RESULT_TOO_LARGE'});
 return payload;
}
