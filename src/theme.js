// Synchronous startup keeps the saved appearance in place before styles paint.
(() => {
  const key='studio.theme.v1',root=document.documentElement;
  const normalize=value=>value==='light'?'light':'dark';
  function apply(value){
    const mode=normalize(value);root.dataset.theme=mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#111113':'#ffffff');
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.setAttribute('aria-checked',String(mode==='dark')));
    document.querySelectorAll('[data-theme-mode-label]').forEach(label=>{label.textContent=mode==='dark'?'다크 모드':'라이트 모드';});
    document.querySelectorAll('[data-theme-select]').forEach(select=>{select.value=mode;});
  }
  const accentKey='studio.accent.v1',normalizeAccent=value=>['blue','purple','green','orange'].includes(value)?value:'blue';
  function applyAccent(value){const accent=normalizeAccent(value);root.dataset.accent=accent;document.querySelectorAll('[data-accent-select]').forEach(input=>{input.checked=input.value===accent;});}
  let accentSaved;try{accentSaved=localStorage.getItem(accentKey);}catch{}applyAccent(accentSaved);
  const fontKey='studio.bibleFont.v1',normalizeFont=value=>Number.isInteger(Number(value))?Math.max(-3,Math.min(3,Number(value))):0;
  function applyFont(value){const step=normalizeFont(value);root.dataset.bibleFont=String(step);root.style.setProperty('--bible-size-offset',`${step/(step>0?8:16)}rem`);document.querySelectorAll('[data-bible-font-size]').forEach(input=>{input.value=String(step);input.setAttribute('aria-valuetext',step===0?'기본':`${step>0?'+':''}${step}`);});document.querySelectorAll('[data-bible-font-value]').forEach(label=>label.textContent=step===0?'기본':`${step>0?'+':''}${step}`);}
  let savedFont;try{savedFont=localStorage.getItem(fontKey);}catch{}applyFont(savedFont);
  document.addEventListener('input',event=>{if(!event.target.matches('[data-bible-font-size]'))return;const step=normalizeFont(event.target.value);applyFont(step);try{localStorage.setItem(fontKey,String(step));}catch{}});
  let saved;try{saved=localStorage.getItem(key);}catch{}
  apply(saved);
  document.addEventListener('change',event=>{
    if(event.target.matches('[data-accent-select]')){const accent=normalizeAccent(event.target.value);applyAccent(accent);try{localStorage.setItem(accentKey,accent);}catch{}return;}
    if(!event.target.matches('[data-theme-select]'))return;
    const mode=normalize(event.target.value);apply(mode);
    try{localStorage.setItem(key,mode);}catch{}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('[data-theme-toggle]'))return;const mode=root.dataset.theme==='dark'?'light':'dark';apply(mode);try{localStorage.setItem(key,mode);}catch{}});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);if(event.key===accentKey||event.key===null)applyAccent(event.newValue);if(event.key===fontKey||event.key===null)applyFont(event.newValue);});
})();
