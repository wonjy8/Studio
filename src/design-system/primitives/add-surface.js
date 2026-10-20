import {escapeHtml as esc} from './html.js';
import {icon} from './icons.js';

// Attributes are application-owned event hooks, never user-provided markup.
export function addSurface({title,description='',attributes='',className=''}={}){
 return `<button type="button" class="add-surface ${esc(className)}" ${attributes}>${icon('plus',{outline:true})}<strong>${esc(title)}</strong>${description?`<span class="sub">${esc(description)}</span>`:''}</button>`;
}
