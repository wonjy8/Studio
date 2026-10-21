// Geometry belongs to CSS alongside the fixed nav, never scroll/rAF callbacks.
// The independent bottom tint still covers content if backdrop sampling lags.
let layer=null;
export function refreshMobileNavigationBackdrop(){
 const rail=document.querySelector('.production-app .workspace-rail');
 if(!layer?.isConnected){if(!rail)return;layer=document.createElement('div');layer.className='mobile-navigation-backdrop';layer.dataset.mobileNavigationBackdrop='';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);}
 layer.hidden=!rail;
}
