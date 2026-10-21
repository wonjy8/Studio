// Page gestures only: canvas transforms and desktop/browser accessibility controls
// remain owned by their existing handlers and the browser respectively.
(() => {
 const mobile=matchMedia('(hover: none) and (pointer: coarse)'),root=document.documentElement,viewport=document.querySelector('meta[name="viewport"]'),original=viewport?.getAttribute('content')||'width=device-width, initial-scale=1.0';
 const localZoom='[data-layout-viewport], [data-layout-stage], canvas, [data-local-zoom]';
 function apply(){root.dataset.mobilePageZoom=mobile.matches?'locked':'native';if(viewport)viewport.setAttribute('content',mobile.matches?original+', maximum-scale=1, user-scalable=no':original);}
 function preventPageGesture(event){if(!mobile.matches||!event.cancelable||event.target.closest?.(localZoom))return;event.preventDefault();}
 // WebKit's cancelable pinch events supplement declarative touch-action. No
 // touchmove, touchend or double-click cancellation: scrolling/selection stay native.
 for(const type of ['gesturestart','gesturechange'])document.addEventListener(type,preventPageGesture,{passive:false});
 if(mobile.addEventListener)mobile.addEventListener('change',apply);else mobile.addListener?.(apply);apply();
})();
