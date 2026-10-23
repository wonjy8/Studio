import {createComputeEngine} from './engine.js';
export let computeFallbackReason='';
export const computeEngine=await createComputeEngine().catch(error=>{
 computeFallbackReason=error.message;
 if(typeof document!=='undefined'){
  const show=()=>{if(document.querySelector('[data-compute-fallback]'))return;const note=document.createElement('p');note.dataset.computeFallback='';note.className='sub';note.setAttribute('role','status');note.textContent='Rust 처리 모듈을 사용할 수 없어 검색·일정에 호환 모드를 사용합니다.';document.body.append(note);};
  if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true});
 }
 return null;
});
