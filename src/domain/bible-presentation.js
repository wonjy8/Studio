import {bibleBooks,bibleAbbreviations,parseBiblePassage} from './bible.js';

export function groupBibleBooks(books){
 return ['구약','신약'].map((label,index)=>({label,books:books.filter(item=>{const position=bibleBooks.indexOf(item.book);return position>=0&&(position<39)===(index===0);}).sort((a,b)=>bibleBooks.indexOf(a.book)-bibleBooks.indexOf(b.book))})).filter(group=>group.books.length);
}

export function categorizeBibleBooks(books){const ranges=[['구약','율법서',0,5],['구약','역사서',5,17],['구약','시가서',17,22],['구약','대선지서',22,27],['구약','소선지서',27,39],['신약','복음서',39,43],['신약','역사서',43,44],['신약','바울서신',44,57],['신약','일반서신',57,65],['신약','예언서',65,66]];return ranges.map(([testament,label,start,end])=>({testament,label,books:books.filter(item=>{const index=bibleBooks.indexOf(item.book);return index>=start&&index<end;}).sort((a,b)=>bibleBooks.indexOf(a.book)-bibleBooks.indexOf(b.book))})).filter(group=>group.books.length);}

// Keep the stored CSV unchanged; extract only explicit headings and note definitions.
export function presentBibleVerse(value){
 const headings=[],notes=[];
 let text=String(value).replace(/<([^<>\n]+)>/g,(_,heading)=>{headings.push(heading.trim());return '';});
 const start=text.search(/\(\s*[a-z]\.\s*/i);
 if(start>=0){
  const tail=text.slice(start),definitions=[...tail.matchAll(/(?:^\(\s*|\s+)([a-z])\.\s*/gi)];
  for(let i=0;i<definitions.length;i++){
   const match=definitions[i];let content=tail.slice(match.index+match[0].length,definitions[i+1]?.index??tail.length).trim();
   // Exported notes can close each definition separately, or share a final parenthesis.
   if(content.endsWith(')'))content=content.slice(0,-1).trim();
   notes.push({marker:match[1],text:content});
  }
  text=text.slice(0,start);
 }
 return {headings,text:text.trim(),notes};
}

const names=[...bibleBooks,...bibleAbbreviations].sort((a,b)=>b.length-a.length).join('|');
export function bibleReferenceParts(text){
 const pattern=new RegExp(`(?<![가-힣A-Za-z])(${names})\\s*\\d{1,3}\\s*(?::|장)\\s*\\d{1,3}(?:절)?(?:\\s*[-~–]\\s*(?:\\d{1,3}:)?\\d{1,3}(?:절)?)?`,'g');
 const parts=[];let end=0;
 for(const match of String(text).matchAll(pattern)){
  if(match.index>end)parts.push({text:text.slice(end,match.index)});
  parts.push({text:match[0],passage:parseBiblePassage(match[0])});end=match.index+match[0].length;
 }
 if(end<text.length)parts.push({text:text.slice(end)});
 return parts;
}
