import {createComputeEngine} from '../src/compute/engine.js';
import {parentPort} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {notionBibleVerses,notionScriptureNotes} from './notion-scripture-import.js';
import {bibleVersionMetadata} from './bible-versions.js';
const engine=await createComputeEngine();
parentPort.once('message',({bytes,preview})=>{
 try{
  const input=Buffer.from(bytes),fingerprint=createHash('sha256').update(input).digest('hex');
  const files=engine.unzip(input),parseCsv=text=>engine.csv(text),bible=notionBibleVerses(files,parseCsv);
  if(bible){const summary={type:'bible',verses:bible.verses.length,books:new Set(bible.verses.map(v=>v.book)).size,...bibleVersionMetadata(bible)};parentPort.postMessage({value:preview?{summary}:{summary,bible,fingerprint}});}
  else{const notes=notionScriptureNotes(files,parseCsv),summary={type:'notes',notes:notes.length,titles:notes.slice(0,10).map(n=>n.document.title)};parentPort.postMessage({value:preview?{summary}:{summary,notes}});}
 }catch(error){parentPort.postMessage({error:{message:error.status===400?error.message:'ZIP 처리에 실패했습니다.',status:error.status===400?400:500}});}
});
