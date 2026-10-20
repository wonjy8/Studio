// Synchronous startup keeps the saved appearance in place before styles paint.
(() => {
  const key='studio.theme.v1',root=document.documentElement;
  const normalize=value=>value==='light'?'light':'dark';
  function apply(value){
    const mode=normalize(value);root.dataset.theme=mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#111113':'#ffffff');
    document.querySelectorAll('[data-theme-select]').forEach(select=>{select.value=mode;});
  }
  let saved;try{saved=localStorage.getItem(key);}catch{}
  apply(saved);
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-theme-select]'))return;
    const mode=normalize(event.target.value);apply(mode);
    try{localStorage.setItem(key,mode);}catch{}
  });
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);});
})();
