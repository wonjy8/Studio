import {projectIconPaths} from '../icons/paths.js';
// Original vector artwork, shared across navigation and project identity.
const paths={
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
const filled={production:'<path d="M4 8h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Zm5 4v6l6-3Z" fill-rule="evenodd"/><path d="m3 3 4-1 3 5H3Zm6-1h4l3 5h-4Zm6 0h4l3 5h-4Z"/>',play:'<path d="m7 3 14 9L7 21Z"/>',folder:'<path d="M2 5a2 2 0 0 1 2-2h6l3 4h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"/>',book:'<path d="M2 3c4 0 7 1 9 3v16c-3-2-5-3-9-3Zm20 0c-4 0-7 1-9 3v16c3-2 5-3 9-3Z"/>',camera:'<path d="m8 3-2 3H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-3Zm4 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill-rule="evenodd"/>',sparkle:'<path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>'};
export function icon(name,{solid=false}={}){
 const custom=projectIconPaths[name];
 if(custom)return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="${name==='brand-kakaotalk'?'currentColor':'none'}" stroke="${name==='brand-kakaotalk'?'none':'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${custom}</svg>`;
 const fill=solid&&filled[name];
 return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="${fill?'currentColor':'none'}" stroke="${fill?'none':'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${fill||paths[name]||paths.production}</svg>`;
}
