import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {bibleVersionStore,bibleVersionMetadata} from '../server/bible-versions.js';
import {scriptureRoutes} from '../server/scripture.js';
const fake=(name,text)=>({name,verses:[{book:'창세기',chapter:1,verse:1,text,testament:'구약',order:0}]});
function fixture(t){const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('owner'),('other');");scriptureRoutes(db);t.after(()=>db.close());return {db,store:bibleVersionStore(db)};}
test('multiple languages remain separate, reimport replaces only its own version and isolates accounts',t=>{
 const {db,store}=fixture(t),ko=store.save('owner',fake('새번역성경.csv','가상의 한글 본문'),'ko1'),en=store.save('owner',fake('NIV_Bible.csv','Fictional English verse'),'en1');
 assert.deepEqual(store.list('owner').map(v=>v.language),['ko','en']);
 const read=id=>store.read('owner',new URLSearchParams({version:id,book:'창세기',chapter:'1'}));
 assert.equal(read(ko.id).verses[0].text,'가상의 한글 본문');assert.equal(read(en.id).verses[0].text,'Fictional English verse');
 assert.equal(store.save('owner',fake('NIV_Bible.csv','Fictional revised verse'),'en2').id,en.id);
 assert.equal(store.list('owner').length,2);assert.equal(read(en.id).verses[0].text,'Fictional revised verse');
 assert.equal(db.prepare('SELECT body FROM scripture_verses').get().body,'가상의 한글 본문');
 assert.equal(store.read('other',new URLSearchParams()).versions.length,0);
 assert.throws(()=>store.read('other',new URLSearchParams({version:en.id})),{status:404});
 db.prepare("DELETE FROM users WHERE id='owner'").run();assert.equal(db.prepare('SELECT count(*) n FROM scripture_versions').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM scripture_version_verses').get().n,0);
});
test('legacy imports remain readable and matching reimport does not duplicate the translation',t=>{
 const {db,store}=fixture(t);db.prepare('INSERT INTO scripture_bibles VALUES(?,?,?,?)').run('owner','표준새번역','old',1);db.prepare('INSERT INTO scripture_verses VALUES(?,?,?,?,?,?,?)').run('owner','창세기',1,1,'기존 가상 본문','구약',0);
 assert.equal(store.list('owner')[0].id,'legacy');assert.equal(store.read('owner',new URLSearchParams({version:'legacy',book:'창세기',chapter:'1'})).verses[0].text,'기존 가상 본문');
 store.save('owner',fake('새번역성경.csv','새 가상 본문'),'new');assert.equal(store.list('owner').length,1);assert.equal(db.prepare('SELECT body FROM scripture_verses').get().body,'새 가상 본문');
});
test('metadata recognizes language and canonical version titles',()=>{assert.equal(bibleVersionMetadata(fake('folder/NIV_Bible.csv','Fictional')).title,'NIV');assert.equal(bibleVersionMetadata(fake('새번역성경.csv','가상')).language,'ko');});

test('cached book summaries remain private and refresh after translation or database changes',t=>{
 const {db,store}=fixture(t),ko=store.save('owner',fake('새번역성경.csv','가상 본문'),'first');
 const read=()=>store.read('owner',new URLSearchParams({version:ko.id,book:'창세기',chapter:'1'}));
 const initial=read();assert.equal(initial.books[0].chapters,1);
 initial.books[0].chapters=999;assert.equal(read().books[0].chapters,1,'caller cannot mutate cached metadata');
 const updated=fake('새번역성경.csv','수정한 가상 본문');updated.verses.push({book:'창세기',chapter:2,verse:1,text:'둘째 장',testament:'구약',order:0});store.save('owner',updated,'second');
 assert.equal(read().books[0].chapters,2);assert.equal(read().verses[0].text,'수정한 가상 본문');assert.deepEqual(store.read('other',new URLSearchParams()).books,[]);
 db.prepare('INSERT INTO scripture_version_verses VALUES(?,?,?,?,?,?,?,?)').run('owner',ko.id,'출애굽기',1,1,'추가 본문','구약',1);
 assert.equal(read().books.length,2,'database changes invalidate metadata');
});
