import test from 'node:test';
import assert from 'node:assert/strict';
import {bibleVerseKey,extendBibleSelection} from '../src/features/bible-comparison.js';
const verses=Array.from({length:10},(_,i)=>bibleVerseKey({book:'창세기',chapter:1,verse:i+1}));
test('range stays anchored at the first verse and shrinks to the latest endpoint',()=>{
 let state={selected:new Set(),anchor:null};
 state=extendBibleSelection(state,verses[0],verses,true);
 state=extendBibleSelection(state,verses[9],verses,true);assert.deepEqual([...state.selected],verses);
 state=extendBibleSelection(state,verses[6],verses,true);assert.deepEqual([...state.selected],verses.slice(0,7));assert.equal(state.anchor,verses[0]);
 state=extendBibleSelection(state,verses[0],verses,true);assert.deepEqual([...state.selected],[verses[0]]);
});
test('fixed-anchor selection crosses backwards and starts afresh after clearing',()=>{
 let state={selected:new Set(),anchor:null};state=extendBibleSelection(state,verses[6],verses,true);state=extendBibleSelection(state,verses[0],verses,true);assert.deepEqual([...state.selected],verses.slice(0,7));
 state=extendBibleSelection(state,verses[9],verses,true);assert.deepEqual([...state.selected],verses.slice(6));
 state={selected:new Set(),anchor:null};state=extendBibleSelection(state,verses[4],verses,true);assert.deepEqual([...state.selected],[verses[4]]);
});
test('canonical addresses distinguish books and chapters and ignore translation lengths',()=>{
 assert.notEqual(bibleVerseKey({book:'창세기',chapter:1,verse:1}),bibleVerseKey({book:'창세기',chapter:2,verse:1}));
 assert.equal(bibleVerseKey({book:'창세기',chapter:1,verse:1,text:'short'}),bibleVerseKey({book:'창세기',chapter:1,verse:1,text:'longer translation'}));
});
