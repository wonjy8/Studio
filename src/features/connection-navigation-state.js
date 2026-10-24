// A stored connection needing attention is navigable, never advertised as healthy.
export function googleNavigationState(service,configured=true){
 if(!service?.connected)return configured?'disconnected':'unavailable';
 return !configured||service.permission!=='approved'||service.latestGranted===false||Boolean(service.error)?'attention':'connected';
}
export function readNavigationState(status){if(!status?.connected)return status?.configured?'disconnected':'unavailable';return !status.configured||status.reconnectRequired?'attention':'connected';}
export function chatgptNavigationState(connections,now=Date.now()){
 const active=connections.filter(c=>Number(c.refresh_expires)>now&&String(c.scope||'').split(/\s+/).includes('studio:read'));
 return {state:active.length?'connected':connections.length?'attention':'disconnected',active:active.length,expired:connections.length-active.length};
}
