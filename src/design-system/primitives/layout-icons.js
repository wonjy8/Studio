import {ionIconAliases,ionIconPaths} from '../icons/ionicons.js';
function renderIonIcon(name,{solid=true}={}){
 const iconName=ionIconAliases[name]||name;
 const variants=ionIconPaths[iconName]||ionIconPaths.cube;
 const style=solid?'filled':'outline';
 return `<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false" fill="${solid?'currentColor':'none'}" stroke="${solid?'none':'currentColor'}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round">${variants[style]}</svg>`;
}
export function layoutIcon(kind,options){return renderIonIcon(kind,options);}
export function lightingIcon(type='panel',options){return renderIonIcon(type,options);}
