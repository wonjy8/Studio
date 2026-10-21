// One deadline per reading surface; rerenders preserve it, later jumps replace it.
export function createBibleJumpHighlight(root,alive=()=>root.isConnected){
 let key=null,timer=0,deadline=0,disposed=false;
 const clear=()=>{clearTimeout(timer);timer=0;key=null;deadline=0;root.querySelectorAll('.bible-jump-highlight').forEach(row=>row.classList.remove('bible-jump-highlight'));};
 const sync=()=>{if(disposed||!alive()){dispose();return;}for(const row of root.querySelectorAll('[data-bible-row]'))row.classList.toggle('bible-jump-highlight',row.dataset.bibleRow===key&&Date.now()<deadline);};
 const show=address=>{clear();if(!alive())return;key=JSON.stringify([address.book,address.chapter,address.verse]);deadline=Date.now()+3000;sync();timer=setTimeout(clear,3000);};
 function dispose(){if(disposed)return;disposed=true;clear();observer.disconnect();}
 const observer=new MutationObserver(()=>{if(!alive())dispose();});observer.observe(document.body,{childList:true,subtree:true});return {show,sync,clear,dispose};
}
