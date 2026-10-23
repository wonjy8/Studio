// These are display URLs only. Stored reference URLs continue to name originals.
export function imageVariantUrl(url,variant='reference'){
 return /^\/api\/(?:files|school\/files|document-files)\/[a-f0-9-]{36}$/i.test(url)?url+'?preview='+(variant==='thumbnail'?'1':'reference'):url;
}

const bound=new WeakSet();
export function bindImageVariantFallback(root){
 if(!root||bound.has(root))return;bound.add(root);
 root.addEventListener('error',event=>{const image=event.target;if(!image.matches?.('img[data-image-variant]'))return;const label=document.createElement('span');label.className='sub';label.textContent='미리보기 없음 · 원본 열기를 사용해 주세요.';image.replaceWith(label);},true);
}
