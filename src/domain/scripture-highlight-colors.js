import {documentColors,documentBackgrounds} from './documents.js';
// Stored semantic values stay unchanged. Purple intentionally keeps its exact color.
export function scriptureHighlightColor(value,property='background'){const colors=property==='color'?documentColors:documentBackgrounds,index=colors.indexOf(value);if(index<1||index===3)return value;return `var(--scripture-highlight-${property}-${index},${value})`;}
