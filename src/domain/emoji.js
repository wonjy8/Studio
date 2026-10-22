// Validation accepts existing skin-tone sequences; only new picker choices omit them.
export function validEmoji(value){return typeof value==='string'&&(value===''||value.length<=32&&[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].length===1&&/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(value));}
export const isDefaultEmojiTone=value=>!/[\u{1f3fb}-\u{1f3ff}]/u.test(value);
