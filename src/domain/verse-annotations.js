// Offsets refer to displayed verse text, never to mutable HTML or the translated source.
export function annotationSlices(text,annotation={},noteId=''){
 const ranges=(annotation.ranges||[]).filter(range=>range.end<=text.length&&text.slice(range.start,range.end)===range.quote);
 const points=[...new Set([0,text.length,...ranges.flatMap(range=>[range.start,range.end])])].sort((a,b)=>a-b),slices=[];
 for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1],active=ranges.filter(range=>range.start<=start&&range.end>=end),marks=noteId?{color:annotation.color||'',background:annotation.background||''}:{};
  if(noteId)for(const range of active.filter(range=>range.noteId===noteId))for(const key of ['color','background','bold','italic','underline','strike','code','href'])if(range[key]!==undefined)marks[key]=range[key];
  const memos=active.filter(range=>range.memo?.trim()).map(range=>({id:range.id,quote:range.quote,text:range.memo}));
  if(annotation.memo?.trim())memos.unshift({id:'legacy',quote:text,text:annotation.memo});
  slices.push({start,end,text:text.slice(start,end),marks,memos});
 }return slices;
}
