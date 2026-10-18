import {identityColors,colorNames} from '../domain/colors.js';
import {icon} from './primitives/icons.js';
export function colorPicker(selected='graphite'){
 return `<fieldset class="icon-picker"><legend>색상</legend><div class="color-options">${identityColors.map(color=>`<label class="color-choice"><input type="radio" name="color" value="${color}" ${color===selected?'checked':''}><span class="color-${color}" title="${colorNames[color]}"><span class="sr-only">${colorNames[color]}</span>${icon('check')}</span></label>`).join('')}</div></fieldset>`;
}
