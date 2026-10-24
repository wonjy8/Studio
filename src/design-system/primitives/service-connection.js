import {icon} from './icons.js';
import {escapeHtml as esc} from './html.js';

// Provider marks reuse the existing licensed brand vectors and central renderer.
export function serviceConnectionHeading({title,brand='google',description='',action,attribute,disabled=false,controls=''}){
 const label=action||title+' 연결';
 return `<div class="connection-service-row"><span class="connection-service-logo" aria-hidden="true">${['calendar','tasks','sheets','docs','forms'].includes(brand)?`<img src="/src/design-system/assets/google/${brand}.svg" alt="" width="26" height="26">`:icon(brand==='openai'?'tabler-brand-openai':'tabler-brand-google',{solid:true})}</span><div class="connection-service-identity"><h3>${esc(title)}</h3><p class="sub" data-service-summary>${esc(description)}</p></div><button class="icon-button connection-service-add" type="button" ${attribute} aria-label="${esc(label)}" title="${esc(label)}" ${disabled?'disabled':''} ${controls?`aria-controls="${esc(controls)}" aria-expanded="false"`:''}>${icon('plus')}</button></div>`;
}
