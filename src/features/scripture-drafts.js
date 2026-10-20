const drafts=new Set();
const current=()=>{for(const draft of drafts)if(!draft.pending()&&!draft.root.isConnected)drafts.delete(draft);return [...drafts];};
export function registerScriptureDraft(draft){drafts.add(draft);return ()=>drafts.delete(draft);}
export const scriptureDraftPending=()=>current().some(draft=>draft.pending());
export async function flushScriptureDrafts({except}={}){for(const draft of current())if(draft.root!==except)await draft.flush();}
export function scriptureAutosave({root,status,read,save,quiet=false}){
 let dirty=false,version=0,job=null,timer,error='';
 const draw=()=>{if(!root.isConnected)return;status.textContent=error|| (job?'저장 중…':dirty?'저장 대기':'저장됨');status.setAttribute('role',error?'alert':'status');if(quiet)status.hidden=!error&&!dirty&&!job;root.querySelector('[data-scripture-save-retry]')?.toggleAttribute('hidden',!error);};
 const draft={root:status,pending:()=>dirty||Boolean(job),async flush(){clearTimeout(timer);if(job)await job;if(!dirty)return;const work=Promise.resolve().then(async()=>{try{error='';while(dirty){const snapshot=structuredClone(read()),savedVersion=version;await save(snapshot);if(savedVersion===version)dirty=false;}}catch(e){error=e.message||String(e);}finally{job=null;draw();}});job=work;draw();await work;if(dirty)throw Error(error||'저장하지 못했습니다.');}};
 drafts.add(draft);const change=()=>{dirty=true;version++;error='';clearTimeout(timer);timer=setTimeout(()=>void draft.flush().catch(()=>{}),600);draw();};
 root.querySelector('[data-scripture-save-retry]')?.addEventListener('click',()=>void draft.flush().catch(()=>{}));draw();return {change,flush:draft.flush,pending:draft.pending};
}
