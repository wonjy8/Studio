import {ionIconAliases,ionIconPaths} from '../icons/ionicons.js';
import {solidProjectIconPaths} from '../icons/solid-paths.js';
import {projectIconPaths} from '../icons/paths.js';
import {editorIconPaths} from '../icons/editor-paths.js';

export function icon(name,{solid=false,outline=false}={}){
 const ionName=ionIconAliases[name]||name;
 const variants=ionIconPaths[ionName];
 if(variants){
  const style=solid&&!outline?'filled':'outline';
  const fill=style==='filled'?'currentColor':'none';
  const stroke=style==='outline'?'currentColor':'none';
  return `<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false" fill="${fill}" stroke="${stroke}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round">${variants[style]}</svg>`;
 }
 const filledCustom=!outline&&solid&&solidProjectIconPaths[name];
 if(filledCustom)return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="none">${filledCustom}</svg>`;
 const custom=projectIconPaths[name]||editorIconPaths[name];
 if(custom)return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="${name==='brand-kakaotalk'?'currentColor':'none'}" stroke="${name==='brand-kakaotalk'?'none':'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${custom}</svg>`;
 const fallback=ionIconPaths.folder;
 const style=solid&&!outline?'filled':'outline';
 return `<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false" fill="${style==='filled'?'currentColor':'none'}" stroke="${style==='outline'?'currentColor':'none'}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round">${fallback[style]}</svg>`;
}

// Navigation keeps the same painted envelope when replacing outline with fill.
// Most upstream Ionicons already match. Studio's shared-path symbols need the
// outline's outer half-stroke retained, rather than a larger CSS icon box.
const navigationCorrections={
 'workspace-home':'stroke="currentColor" stroke-width="32"',
 cross:'stroke="currentColor" stroke-width="32"',
 'prayer-hands':'stroke="currentColor" stroke-width="32"',
 // Preserve the sheet separator while matching raster bounds [53,54,465,469].
 'workspace-materials':'transform="matrix(1.1126 0 0 1.1126 -34.7264 -23.8779)"',
 // Upstream filled book ends at y=448; the outline round cap ends at y=464.
 book:'transform="matrix(1 0 0 1.04 0 -1.92)"'
};
export function navigationIcon(name,options={}){
 const svg=icon(name,options);if(!options.solid||options.outline)return svg;
 const correction=navigationCorrections[ionIconAliases[name]||name];
 if(!correction)return svg;
 return svg.replace(/(<svg[^>]*>)([\s\S]*)(<\/svg>)/,`$1<g ${correction}>$2</g>$3`);
}
