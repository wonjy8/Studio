import test from 'node:test';
import assert from 'node:assert/strict';
import {groupBibleBooks,presentBibleVerse,bibleReferenceParts} from '../src/domain/bible-presentation.js';
test('groups follow canonical testament order',()=>{assert.deepEqual(groupBibleBooks([{book:'요한계시록'},{book:'말라기'},{book:'창세기'},{book:'마태복음'}]).map(g=>[g.label,g.books.map(b=>b.book)]),[['구약',['창세기','말라기']],['신약',['마태복음','요한계시록']]]);});
test('headings and nested multiple notes are separated without changing ordinary parentheses',()=>{assert.deepEqual(presentBibleVerse('<테스트 제목> c) 가상의 a) 본문. (c. 다른 말(설명)) a. 창 2:7 참고)'),{headings:['테스트 제목'],text:'c) 가상의 a) 본문.',notes:[{marker:'c',text:'다른 말(설명)'},{marker:'a',text:'창 2:7 참고'}]});assert.deepEqual(presentBibleVerse('본문 (일반 괄호)'),{headings:[],text:'본문 (일반 괄호)',notes:[]});});
test('references accept full names, abbreviations and ranges, but not partial words',()=>{const text='창 2:7, 요한복음 3:16-18; 참고마 1:1',parts=bibleReferenceParts(text),refs=parts.filter(p=>p.passage);assert.equal(refs.length,2);assert.equal(refs[0].passage.book,'창세기');assert.equal(refs[1].passage.end,18);assert.equal(parts.map(p=>p.text).join(''),text);});
