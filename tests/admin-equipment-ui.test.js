import test from 'node:test';
import assert from 'node:assert/strict';
import {adminEquipmentCards} from '../src/features/accounts.js';
test('admin renders each physical catalog item once with all project usages and retains unlinked gear',()=>{
 const catalog=[{id:'camera-one',name:'Fictional Camera',category:'camera',ownerAccountId:'owner-one'},{id:'retained-one',name:'Retained <Light>',category:'lighting',ownerAccountId:'owner-one'}];
 const first={id:'gear-one',catalogId:'camera-one',name:'Old project name',ownerAccountId:'owner-one',username:'fictional-owner',projectId:'project-one',projectName:'Fictional One',owner:'Fictional Crew'};
 const second={...first,id:'gear-two',projectId:'project-two',projectName:'Fictional Two',assignee:'Fictional Operator'};
 const html=adminEquipmentCards([first,second,first],catalog);
 assert.equal((html.match(/class="card"/g)||[]).length,2);
 assert.equal((html.match(/<strong>Fictional Camera<\/strong>/g)||[]).length,1);
 assert.equal((html.match(/Fictional One/g)||[]).length,1);
 assert.match(html,/Fictional Two/);assert.match(html,/Fictional Operator/);assert.match(html,/Retained &lt;Light&gt;/);assert.match(html,/프로젝트 연결 없음/);assert.doesNotMatch(html,/Old project name/);
});
test('admin retains legacy usage-only records without merging distinct physical items by name',()=>{
 const html=adminEquipmentCards([{id:'g1',catalogId:'c1',name:'Same model',projectId:'p1',projectName:'First'},{id:'g2',catalogId:'c2',name:'Same model',projectId:'p1',projectName:'First'}]);
 assert.equal((html.match(/class="card"/g)||[]).length,2);assert.match(adminEquipmentCards(),/등록된 장비가 없습니다/);
});
