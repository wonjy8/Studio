export const bibleFontKey='studio.bibleFont.v1';
export const normalizeBibleFont=value=>Number.isInteger(Number(value))?Math.max(-3,Math.min(3,Number(value))):0;
export const bibleFontOffset=step=>`${normalizeBibleFont(step)/(normalizeBibleFont(step)>0?8:16)}rem`;
