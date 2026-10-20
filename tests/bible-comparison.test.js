import test from 'node:test';
import assert from 'node:assert/strict';
import {bibleVerseKey,extendBibleSelection} from '../src/features/bible-comparison.js';
const verses=Array.from({length:9},(_,i)=>bibleVerseKey({book:'창세기',chapter:1,verse:i+1}));
test('each successive click extends from the previous endpoint, including backwards ranges',()=>{
 let state={selected:new Set(),anchor:null};
 state=extendBibleSelection(state,verses[1],verses,true);
 state=extendBibleSelection(state,verses[5],verses,true);
 assert.deepEqual([...state.selected],verses.slice(1,6));
 state=extendBibleSelection(state,verses[8],verses,true);
 assert.equal(state.selected.size,8);
 state=extendBibleSelection(state,verses[0],verses,true);
 assert.equal(state.selected.size,9);
 state=extendBibleSelection(state,verses[4],verses,false);
 assert.equal(state.selected.has(verses[4]),false);
 assert.equal(state.selected.size,8);
});
test('canonical addresses distinguish books and chapters and ignore translation lengths',()=>{
 assert.notEqual(bibleVerseKey({book:'창세기',chapter:1,verse:1}),bibleVerseKey({book:'창세기',chapter:2,verse:1}));
 assert.equal(bibleVerseKey({book:'창세기',chapter:1,verse:1,text:'short'}),bibleVerseKey({book:'창세기',chapter:1,verse:1,text:'longer translation'}));
});
