import {verseInPassage} from './bible.js';
export const nivOmissions=new Set(['마태복음:17:21','마태복음:18:11','마태복음:23:14','마가복음:7:16','마가복음:9:44','마가복음:9:46','마가복음:11:26','마가복음:15:28','누가복음:17:36','누가복음:23:17','요한복음:5:4','사도행전:8:37','사도행전:15:34','사도행전:24:7','사도행전:28:29','로마서:16:24']);
// Display-only rows keep empty NIV references visible without altering stored text.
export function withBibleOmissions(verses,version,{book,chapter,passage}={}){
 if(!/(?:^|[^A-Za-z])NIV(?:$|[^A-Za-z])|New International Version/i.test(version?.title||''))return verses;
 const result=[...verses],seen=new Set(verses.map(v=>v.book+':'+v.chapter+':'+v.verse));
 for(const key of nivOmissions){
  const [name,ch,v]=key.split(':'),row={book:name,chapter:Number(ch),verse:Number(v),text:'',omitted:true};
  if(!seen.has(key)&&(passage?verseInPassage(row,passage):row.book===book&&row.chapter===Number(chapter)))result.push(row);
 }
 return result.sort((a,b)=>a.chapter-b.chapter||a.verse-b.verse);
}
