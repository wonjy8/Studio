import test from 'node:test';
import assert from 'node:assert/strict';
import {appendHomeGratitude} from '../src/features/home-qt.js';
import {newScriptureNote,validScriptureNote} from '../src/domain/scripture.js';
import {newQtJournal} from '../src/domain/qt-journal.js';
test('home gratitude appends to the existing QT while preserving its other fields and source',()=>{
 const note=newScriptureNote('qt','2026-10-20');note.qtJournal=newQtJournal();note.qtJournal.word='Existing word';note.qtJournal.application='Existing application';note.qtJournal.gratitude[0].text='Existing thanks';note.qtVerses=[{book:'창세기',chapter:1,verse:1,text:'Fictional verse'}];const before=structuredClone(note),value=appendHomeGratitude(note,' New thanks ');
 assert.deepEqual(note,before);assert.equal(value.qtJournal.gratitude.length,2);assert.equal(value.qtJournal.gratitude[1].text,'New thanks');assert.equal(value.qtJournal.gratitude[0].id,note.qtJournal.gratitude[0].id);assert.equal(value.qtJournal.word,'Existing word');assert.equal(value.qtJournal.application,'Existing application');assert.deepEqual(value.qtVerses,note.qtVerses);assert.equal(validScriptureNote(value),true);
});
test('home gratitude initializes older records, reuses an empty line and rejects blank input',()=>{const note=newScriptureNote('qt','2026-10-20'),value=appendHomeGratitude(note,'Thanks');assert.equal(value.qtJournal.gratitude.length,1);assert.equal(value.qtJournal.gratitude[0].text,'Thanks');assert.deepEqual(value.document,note.document);assert.throws(()=>appendHomeGratitude(note,'  '));});

test('home gratitude accepts formatted empty items and retains existing rich text',()=>{const note=newScriptureNote('qt','2026-10-20');note.qtJournal=newQtJournal();note.qtJournal.gratitude[0].content=[{text:''}];note.qtJournal.word='Keep';note.qtJournal.wordContent=[{text:'Keep',bold:true}];const value=appendHomeGratitude(note,'Thanks');assert.equal(validScriptureNote(value),true);assert.deepEqual(value.qtJournal.wordContent,note.qtJournal.wordContent);});
