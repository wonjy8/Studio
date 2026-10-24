import {icon} from './icons.js';
import {escapeHtml as esc} from './html.js';
// Return navigation only; never use for Cancel/Close/Undo/calendar periods.
export function backNavigation(label,attributes='',{href}={}){
 const tag=href?'a':'button',destination=href?`href="${esc(href)}"`:'type="button"';
 return `<${tag} class="icon-button back-navigation" ${destination} ${attributes} aria-label="${esc(label)}" title="${esc(label)}">${icon('chevron')}</${tag}>`;
}
