// Explicit disconnect/new-connect invalidates an in-flight OAuth callback.
// State/session checks still live in each integration; no credentials are stored here.
export function googleOAuthAttempts(){const pending=new Map();return {begin(uid,check){const attempt=Symbol();pending.set(uid,attempt);return ()=>{check();if(pending.get(uid)!==attempt)throw Object.assign(Error('Google 연결 요청이 취소되거나 변경되었습니다.'),{status:409});};},cancel:uid=>pending.delete(uid),close:()=>pending.clear()};}
