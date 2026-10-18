import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEquipmentSheet,validateEquipmentSheet} from '../src/features/inventory-sheet.js';
test('equipment sheets parse Korean CSV headers, quoted cells, CRLF and tab-separated pasted tables',()=>{
 const rows=parseEquipmentSheet('\uFEFF장비명,분류,모델,관리 방식,수량\r\n"패널, A",조명,"모델 ""A""",수량,5\r\n');assert.equal(rows[0].name,'패널, A');assert.equal(rows[0].model,'모델 "A"');assert.equal(rows[0].category,'lighting');assert.equal(validateEquipmentSheet(rows).items[0].quantity,5);
 assert.equal(parseEquipmentSheet('장비명\t분류\n카메라\tcamera')[0].category,'camera');assert.throws(()=>parseEquipmentSheet('wrong\nrow'));assert.throws(()=>parseEquipmentSheet('장비명,분류\n"unclosed,camera'));assert.throws(()=>parseEquipmentSheet('장비명,분류\na,camera,extra'));
});
test('sheet validation ignores untouched rows and rejects missing names, unknown categories and non-integer counts',()=>{
 assert.equal(validateEquipmentSheet([{}, {name:'Panel',category:'lighting'}]).items.length,1);
 for(const row of [{quantity:'3'}, {name:'X',category:'invalid'},{name:'X',quantity:'2'},{name:'X',trackingMode:'bulk',quantity:'1e3'},{name:'X',trackingMode:'bulk',quantity:'1.5'}])assert.ok(validateEquipmentSheet([row]).errors.length);
 assert.ok(validateEquipmentSheet(Array.from({length:201},()=>({name:'X'}))).errors.length);assert.equal(validateEquipmentSheet([{name:'X',trackingMode:'bulk',quantity:'0'}]).items[0].quantity,0);
});
