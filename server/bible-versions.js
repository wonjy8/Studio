import {createHash} from 'node:crypto';
import {parseBiblePassage} from '../src/domain/bible.js';

export function bibleVersionMetadata(bible){
 const filename=bible.name.normalize('NFKC').split('/').at(-1);
 const known=[[/(?:^|[^A-Za-z])NIV(?:$|[^A-Za-z])|New International Version/i,'NIV','en'],[/\bESV\b/i,'ESV','en'],[/\bKJV\b/i,'KJV','en'],[/\bNASB\b/i,'NASB','en'],[/개역개정/,'개역개정','ko'],[/개역한글/,'개역한글','ko'],[/새번역/,'표준새번역','ko']].find(([pattern])=>pattern.test(filename));
 const title=known?.[1]||filename.replace(/\.csv$/i,'').replace(/_all$/i,'').replace(/\s+[a-f0-9]{32}$/i,'').replace(/\s*DB$/i,'').trim();
 const normalizedTitle=/^(성경|Bible)$/i.test(title)?'표준새번역':title;
 const language=known?.[2]||(/[가-힣]/.test(bible.verses.slice(0,20).map(v=>v.text).join(''))||normalizedTitle==='표준새번역'?'ko':'en');
 return {id:'version-'+createHash('sha256').update(normalizedTitle.toLowerCase()).digest('hex').slice(0,20),title:normalizedTitle||'성경',language};
}
export function bibleVersionStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS scripture_versions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,id TEXT NOT NULL,title TEXT NOT NULL,language TEXT NOT NULL,fingerprint TEXT NOT NULL,imported_at INTEGER NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS scripture_version_verses(user_id TEXT NOT NULL,version_id TEXT NOT NULL,book TEXT NOT NULL,chapter INTEGER NOT NULL,verse INTEGER NOT NULL,body TEXT NOT NULL,testament TEXT NOT NULL,book_order INTEGER NOT NULL,PRIMARY KEY(user_id,version_id,book,chapter,verse),FOREIGN KEY(user_id,version_id) REFERENCES scripture_versions(user_id,id) ON DELETE CASCADE);`);
 const legacy=uid=>db.prepare('SELECT title,fingerprint,imported_at importedAt FROM scripture_bibles WHERE user_id=?').get(uid);
 function list(uid){
  const versions=db.prepare('SELECT id,title,language,fingerprint,imported_at importedAt FROM scripture_versions WHERE user_id=? ORDER BY imported_at,id').all(uid),prior=legacy(uid);
  if(prior&&!versions.some(v=>v.fingerprint===prior.fingerprint))versions.unshift({id:'legacy',...prior,language:/NIV|ESV|KJV|NASB/i.test(prior.title)?'en':'ko'});
  return versions.sort((a,b)=>Number(b.fingerprint===prior?.fingerprint)-Number(a.fingerprint===prior?.fingerprint)||a.importedAt-b.importedAt||a.id.localeCompare(b.id));
 }
 function read(uid,params){
  const versions=list(uid),requested=params.get('version'),selected=requested?versions.find(v=>v.id===requested):versions[0];
  if(requested&&!selected)throw Object.assign(Error('성경 버전을 찾을 수 없습니다.'),{status:404});
  const source=selected?.id==='legacy'?'scripture_verses':'scripture_version_verses',condition=selected?.id==='legacy'?'user_id=?':'user_id=? AND version_id=?',args=selected?.id==='legacy'?[uid]:[uid,selected?.id||''];
  const books=db.prepare(`SELECT book,testament,count(*) verses,max(chapter) chapters FROM ${source} WHERE ${condition} GROUP BY book ORDER BY min(book_order)`).all(...args);
  const passage=parseBiblePassage(params.get('passage')||''),book=params.get('book'),chapter=Number(params.get('chapter')),search=params.get('q')?.trim().slice(0,200)||'';
  let verses=[];const fields='book,chapter,verse,body text';
  if(passage)verses=db.prepare(`SELECT ${fields} FROM ${source} WHERE ${condition} AND book=? AND chapter>=? AND chapter<=? AND (chapter<>? OR verse>=?) AND (chapter<>? OR verse<=?) ORDER BY chapter,verse LIMIT 501`).all(...args,passage.book,passage.chapter,passage.endChapter,passage.chapter,passage.start,passage.endChapter,passage.end);
  else if(book&&Number.isSafeInteger(chapter)&&chapter>0)verses=db.prepare(`SELECT ${fields} FROM ${source} WHERE ${condition} AND book=? AND chapter=? ORDER BY verse`).all(...args,book,chapter);
  else if(search)verses=db.prepare(`SELECT ${fields} FROM ${source} WHERE ${condition} AND instr(body,?)>0 ORDER BY book_order,chapter,verse LIMIT 100`).all(...args,search);
  const clean=({fingerprint,...value})=>value;
  return {bible:selected?clean(selected):null,versions:versions.map(clean),books,verses};
 }
 function save(uid,bible,fingerprint){
  const meta=bibleVersionMetadata(bible),current=db.prepare('SELECT fingerprint FROM scripture_versions WHERE user_id=? AND id=?').get(uid,meta.id),prior=legacy(uid);
  if(current?.fingerprint===fingerprint)return {...meta,alreadyImported:true};
  db.prepare('INSERT INTO scripture_versions VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET title=excluded.title,language=excluded.language,fingerprint=excluded.fingerprint,imported_at=excluded.imported_at').run(uid,meta.id,meta.title,meta.language,fingerprint,Date.now());
  db.prepare('DELETE FROM scripture_version_verses WHERE user_id=? AND version_id=?').run(uid,meta.id);
  const insert=db.prepare('INSERT INTO scripture_version_verses VALUES(?,?,?,?,?,?,?,?)');for(const v of bible.verses)insert.run(uid,meta.id,v.book,v.chapter,v.verse,v.text,v.testament,v.order);
  // Retain the existing default translation for QT and older clients; new imports do not overwrite it.
  if(!prior||prior.title===meta.title||prior.fingerprint===current?.fingerprint||prior.fingerprint===fingerprint){
   db.prepare('DELETE FROM scripture_verses WHERE user_id=?').run(uid);
   const old=db.prepare('INSERT INTO scripture_verses VALUES(?,?,?,?,?,?,?)');for(const v of bible.verses)old.run(uid,v.book,v.chapter,v.verse,v.text,v.testament,v.order);
   db.prepare('INSERT INTO scripture_bibles VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET title=excluded.title,fingerprint=excluded.fingerprint,imported_at=excluded.imported_at').run(uid,meta.title,fingerprint,Date.now());
  }
  return {...meta,alreadyImported:prior?.fingerprint===fingerprint};
 }
 return {list,read,save};
}
