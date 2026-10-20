import {editorIconPaths} from '../icons/editor-paths.js';
import {solidProjectIconPaths} from '../icons/solid-paths.js';
import {projectIconPaths} from '../icons/paths.js';
// Original vector artwork, shared across navigation and project identity.
const paths={
 panelRightHide:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18m-6-12 3 3-3 3"/>',
 panelRightShow:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18m-4-12-3 3 3 3"/>',
 lens:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 4 14 4 14 0V6M5 11c0 4 14 4 14 0M5 15c0 4 14 4 14 0"/>',
 lighting:'<rect x="3" y="3" width="18" height="12" rx="2"/><path d="M7 7h10M7 11h10M12 15v4m-5 3 5-3 5 3"/>',
 sd:'<path d="M8 3h10a2 2 0 0 1 2 2v16H4V7Z"/><path d="M9 4v5m4-5v5m4-5v5M8 14h8v4H8Z"/>',
 tripod:'<path d="M8 3h8v5H8ZM12 8v5m-3-3-5 12m11-12 5 12m-8-9v9M7 17h10"/>',
 audio:'<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',

 // Fixed filled camcorder silhouette for the equipment workspace rail.
 camcorder:'<rect x="2" y="8" width="14" height="12" rx="2"/><path d="M17 11 22 8v12l-5-3ZM6 3h6a2 2 0 0 1 2 2v1h-2V5H6v1H4V5a2 2 0 0 1 2-2Z"/>,
 shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
 pencil:'<path d="m15 4 5 5M4 16 16 4a2 2 0 0 1 4 4L8 20l-5 1Z"/>',
 production:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M3 11h18M4 7l3-4 4 4m-1-4 4 4m-1-4 4 4m-1-4 4 4"/>',
 home:'<path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18M7 14h1m3 0h1m3 0h1M7 17h1m3 0h1"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 camera:'<path d="M8 6 10 3h4l2 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12.5" r="4"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
 gear:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12h18M9 12v3h6v-3"/>',
 settings:'<path d="m10 3-1 3-3 1-3 3v4l3 1 1 3 3 3h4l1-3 3-1 3-3v-4l-3-1-1-3-3-3Z"/><circle cx="12" cy="12" r="3"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 book:'<path d="M12 5v16M3 3c4 0 6 1 9 3 3-2 5-3 9-3v15c-4 0-6 1-9 3-3-2-5-3-9-3Z"/>',
 folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
 sparkle:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 logout:'<path d="M10 3H4v18h6m5-14 5 5-5 5m-7-5h12"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
const filled={
 panelRightHide:'<path d="M3 3h12v18H3zM15 3h6v18h-6z"/><path d="m8 9 3 3-3 3M11 12h2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
 panelRightShow:'<path d="M3 3h12v18H3zM15 3h6v18h-6z"/><path d="m10 9-3 3 3 3M7 12h2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
 lens:'<path d="M5 6c0-2 14-2 14 0v12c0 4-14 4-14 0V6Zm0 5c0 4 14 4 14 0M5 15c0 4 14 4 14 0" fill-rule="evenodd"/>',
 lighting:'<path d="M3 3h18v12H3zM11 15h2v4h-2zM7 22l5-3 5 3H7Z"/><path d="M7 7h10M7 11h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
 sd:'<path d="M8 3h10a2 2 0 0 1 2 2v16H4V7l4-4Z"/><path d="M9 4v5m4-5v5m4-5v5" fill="none" stroke="var(--bg,#fff)" stroke-width="1.7" stroke-linecap="round"/><path d="M8 14h8v4H8z" fill="var(--bg,#fff)"/>',
 tripod:'<path d="M8 3h8v5H8zM11 8h2v5h-2zM9 10 4 22h2l5-12zm6 0 5 12h-2l-5-12zm-4 3h2v9h-2zM7 17h10v1H7z"/>',
 audio:'<path d="M8 6a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0V6ZM5 10h2v2a5 5 0 0 0 10 0v-2h2v2a7 7 0 0 1-6 6.93V21h4v2H7v-2h4v-2.07A7 7 0 0 1 5 12v-2Z"/>',
 camcorder:'<rect x="2" y="8" width="14" height="12" rx="2"/><path d="M17 11 22 8v12l-5-3ZM6 3h6a2 2 0 0 1 2 2v1h-2V5H6v1H4V5a2 2 0 0 1 2-2Z"/>',
 shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm0 2.2 6 2.25V12c0 3.7-5.2 6.9-6 7.35C11.2 18.9 6 15.7 6 12V7.45l6-2.25Z" fill-rule="evenodd"/><path d="m8 12 3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
 pencil:'<path d="m15 4 5 5L8 20l-5 1 1-5L16 4a2 2 0 0 1 4 4Z"/>',
 production:'<path d="M3 7h18v14H3zM4 7l3-4 4 4m-1-4 4 4m-1-4 4 4m-1-4 4 4" />',
 home:'<path d="m3 11 9-8 9 8-2 2-2-2v9h-5v-6h-4v6H5v-9l-1 2-1-2Z"/>',
 calendar:'<path d="M3 5h18v16H3zM7 3h2v4H7zm8 0h2v4h-2z"/><path d="M3 10h18" fill="none" stroke="var(--bg,#fff)" stroke-width="1.7"/><path d="M7 14h1v1H7zm4 0h1v1h-1zm4 0h1v1h-1zm-8 3h1v1H7zm4 0h1v1h-1z"/>',
 check:'<path d="m5 12 4 4L19 6l1.5 1.5L9 20 3.5 13.5Z"/>',
 camera:'<path d="M8 6 10 3h4l2 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12.5" r="4" fill="var(--bg,#fff)"/>',
 image:'<path d="M3 3h18v18H3z"/><circle cx="8" cy="8" r="1.5" fill="var(--bg,#fff)"/><path d="m3 17 5-5 4 4 4-6 5 7Z" fill="var(--bg,#fff)"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3H3Zm14-16a3 3 0 0 1 0 6v-2a1 1 0 0 0 0-2zm2 8a5 5 0 0 1 3 4v4h-2v-4a3 3 0 0 0-2-2.83z"/>',
 gear:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12h18M9 12v3h6v-3" fill="none" stroke="var(--bg,#fff)" stroke-width="1.7" stroke-linejoin="round"/>',
 settings:'<path d="m10 3-1 3-3 1-3 3v4l3 1 1 3 3 3h4l1-3 3-1 3-3v-4l-3-1-1-3-3-3Zm2 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" fill-rule="evenodd"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 book:'<path d="M3 3c4 0 6 1 9 3v15c-3-2-5-3-9-3Zm18 0c-4 0-6 1-9 3v15c3-2 5-3 9-3Z"/>',
 folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
 sparkle:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
 plus:'<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
 chevron:'<path d="M7 4 19 12 7 20 5 17l7.5-5L5 7z"/>',
 menu:'<rect x="4" y="5" width="16" height="3" rx="1.5"/><rect x="4" y="10.5" width="16" height="3" rx="1.5"/><rect x="4" y="16" width="16" height="3" rx="1.5"/>',
 logout:'<path d="M10 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6v-2H4V5h6zm5 3-1.4 1.4 3.6 3.6H8v2h9.2l-3.6 3.6L15 18l6-6z"/>',
 close:'<path d="m7 4 5 5 5-5 3 3-5 5 5 5-3 3-5-5-5 5-3-3 5-5-5-5z"/>'
};
export function icon(name,{solid=false,outline=false}={}){
 const filledCustom=!outline&&solid&&!filled[name]&&solidProjectIconPaths[name];
 if(filledCustom)return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="none">${filledCustom}</svg>`;
 const custom=projectIconPaths[name]||editorIconPaths[name];
 if(custom&&!(solid&&filled[name]))return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="${name==='brand-kakaotalk'?'currentColor':'none'}" stroke="${name==='brand-kakaotalk'?'none':'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${custom}</svg>`;
 const fill=solid&&filled[name];
 return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="${fill?'currentColor':'none'}" stroke="${fill?'none':'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${fill||paths[name]||paths.production}</svg>`;
}
