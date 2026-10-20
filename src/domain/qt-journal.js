import {bibleBooks,parseBiblePassage} from './bible.js';
import {documentColors,documentBackgrounds} from './documents.js';
const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const text=(value,max=20000)=>typeof value==='string'&&value.length<=max;
export const newQtItem=(prayer=false)=>({id:'qt-item-'+crypto.randomUUID(),text:'',...(prayer?{recipient:'',target:'self'}:{})});
export const newQtJournal=()=>({version:1,gratitude:[newQtItem()],word:'',application:'',prayers:[newQtItem(true)]});
export function validQtJournal(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['version','gratitude','word','application','prayers'].includes(key))||value.version!==1||!text(value.word)||!text(value.application))return false;
 const all=[];for(const key of ['gratitude','prayers']){if(!Array.isArray(value[key])||value[key].length>500)return false;for(const item of value[key]){if(!item||!identity(item.id)||!text(item.text)||Object.keys(item).some(field=>!(key==='prayers'?['id','text','recipient','target']:['id','text']).includes(field))||(key==='prayers'&&(!text(item.recipient,200)||!['self','other'].includes(item.target)||item.target==='self'&&item.recipient!=='')))return false;all.push(item);}}
 return new Set(all.map(item=>item.id)).size===all.length&&all.reduce((sum,item)=>sum+item.text.length,0)+value.word.length+value.application.length<=200000;
}
export function validVerseIdentity(value){return value&&bibleBooks.includes(value.book)&&Number.isSafeInteger(value.chapter)&&value.chapter>0&&value.chapter<=200&&Number.isSafeInteger(value.verse)&&value.verse>0&&value.verse<=200;}
export function validQtVerses(value){return Array.isArray(value)&&value.length<=500&&value.every(v=>validVerseIdentity(v)&&Object.keys(v).every(k=>['book','chapter','verse','text'].includes(k))&&text(v.text,8000))&&new Set(value.map(v=>`${v.book}:${v.chapter}:${v.verse}`)).size===value.length&&value.reduce((sum,v)=>sum+v.text.length,0)<=200000;}
export function qtReadingVerses(reading,imported=[]){
 if(imported.length)return imported;const passage=parseBiblePassage(reading.passage);if(!passage)throw Error('QT 성경 본문을 확인하세요.');
 const verses=reading.verses.map(v=>{const match=String(v.label).match(/^(?:(\d+):)?(\d+)$/);if(!match||(!match[1]&&passage.chapter!==passage.endChapter))throw Error('매일성경 구절 번호를 확인하지 못했습니다.');return {book:passage.book,chapter:match[1]?Number(match[1]):passage.chapter,verse:Number(match[2]),text:v.text};});
 if(!validQtVerses(verses)||verses.some(v=>v.chapter<passage.chapter||v.chapter>passage.endChapter||v.chapter===passage.chapter&&v.verse<passage.start||v.chapter===passage.endChapter&&v.verse>passage.end))throw Error('QT 구절 범위를 확인하지 못했습니다.');return verses;
}
export function validVerseAnnotation(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>['book','chapter','verse','color','background','memo'].includes(key))&&validVerseIdentity(value)&&(value.color===''||documentColors.includes(value.color))&&(value.background===''||documentBackgrounds.includes(value.background))&&text(value.memo,20000);}

// Older QT documents already contain quoted scripture. Keep their source text available offline.
export function legacyQtVerses(note){
 const passage=parseBiblePassage(note.passage||'');if(!passage)return [];
 const found=new Map();for(const block of note.document.blocks){if(block.type!=='quote')continue;for(const line of block.content.map(run=>run.text).join('').split('\n')){const match=line.match(/^(?:(\d+):)?(\d+)\s+(.+)$/);if(!match||!match[1]&&passage.chapter!==passage.endChapter)continue;const verse={book:passage.book,chapter:match[1]?Number(match[1]):passage.chapter,verse:Number(match[2]),text:match[3]};if(verse.chapter<passage.chapter||verse.chapter>passage.endChapter||verse.chapter===passage.chapter&&verse.verse<passage.start||verse.chapter===passage.endChapter&&verse.verse>passage.end)continue;found.set(`${verse.chapter}:${verse.verse}`,verse);}}
 const verses=[...found.values()];return validQtVerses(verses)?verses:[];
}
