import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creditCategories,emptyGraduation,graduationSummary} from '../src/domain/school-graduation.js';
import {schoolCreditGroups,validSchool} from '../src/domain/school.js';
import {creditCategoryOptions,graduationRequirements,schoolDashboard} from '../src/features/school-graduation.js';
import {setRequirementArea} from '../src/domain/school-requirement-area.js';
const course=(id,creditCategory,credits=3,creditGroup='')=>({id,semesterId:'term',name:id,status:'completed',credits,creditCategory,creditGroup,grade:'P',documents:[],tasks:[],events:[]});
const fixture=()=>({requiredCredits:130,semesters:[{id:'term',name:'2026-2'}],courses:[course('required','major-elective-required',3,'retake'),course('repeat','major-elective-required',3,'retake'),course('general','major-elective-general'),course('legacy','major-elective',2.5)],graduation:{...emptyGraduation(),areas:[{id:'a',name:'전공 선택(필수)',group:'major',requiredCredits:9},{id:'b',name:'전공 선택(일반)',group:'major',requiredCredits:6},{id:'legacy-area',name:'사용자 지정 요건',group:'major',requiredCredits:3}],mappings:{'major-elective-required':'a','major-elective-general':'b','major-elective':'legacy-area'}}});
test('current labels share unchanged IDs and retired major elective remains existing-value only',()=>{
 for(const [id,name]of [['major-elective-required','전공선택(필수)'],['major-elective-general','전공선택(일반)']]){
  assert.equal(creditCategories.find(c=>c.id===id).name,name);
  assert.ok(creditCategoryOptions().includes('>'+name+'</option>'));
 }
 assert.ok(!creditCategoryOptions().includes('value="major-elective"'));
 assert.ok(creditCategoryOptions('major-elective').includes('value="major-elective" selected'));
});
test('old generated area names display current labels without modifying data, links or deduplicated credits',()=>{
 const school=fixture(),before=structuredClone(school);assert.ok(validSchool(school));
 for(const render of [schoolDashboard,graduationRequirements]){
  const html=render(school);assert.ok(html.includes('전공선택(필수)'));assert.ok(html.includes('전공선택(일반)'));
  assert.ok(!html.includes('전공 선택(필수)'));assert.ok(!html.includes('전공 선택(일반)'));
  assert.ok(html.includes('사용자 지정 요건'));
 }
 const summary=graduationSummary(school,schoolCreditGroups(school));assert.equal(summary.composition.major,8.5);assert.deepEqual(summary.areas.map(a=>a.earned),[3,3,2.5]);assert.equal(summary.unallocated,0);
 assert.deepEqual(school,before);assert.ok(JSON.stringify(school).includes('전공 선택(필수)'));
 delete school.graduation.mappings['major-elective'];
 assert.equal(graduationSummary(school,schoolCreditGroups(school)).unallocated,2.5);
 assert.ok(schoolDashboard(school).includes('요건 미배정'));
});
test('custom names and ambiguously mapped old names are never inferred or rewritten',()=>{
 const school=fixture();school.graduation.areas[0].name='내 전공 요건';assert.ok(schoolDashboard(school).includes('내 전공 요건'));
 school.graduation.areas[0].name='전공 선택(필수)';school.graduation.mappings['major-core']='a';assert.ok(schoolDashboard(school).includes('전공 선택(필수)'));
 const fresh={requiredCredits:null,semesters:[],courses:[]};
 setRequirementArea(fresh,{group:'major',creditCategory:'major-elective-required',requiredCredits:null},'new');assert.equal(fresh.graduation.areas[0].name,'전공선택(필수)');
});

test('custom stored requirement names can produce typo labels without changing canonical categories or course allocation',async()=>{
 const {emptySchool,schoolCreditGroups}=await import('../src/domain/school.js');
 const {graduationSummary}=await import('../src/domain/school-graduation.js');
 const {schoolDashboard,graduationRequirements}=await import('../src/features/school-graduation.js');
 const school={...emptySchool(),semesters:[{id:'term',name:'Term'}],courses:[{id:'course',semesterId:'term',name:'Fixture',credits:3,creditCategory:'major-elective-required',creditGroup:'',documents:[],tasks:[],events:[]}],graduation:{version:1,areas:[{id:'custom',name:'전공선태',group:'major',requiredCredits:6}],mappings:{'major-elective-required':'custom'},gpaCourseIds:[]}};
 const before=structuredClone(school);
 assert.match(schoolDashboard(school),/전공선태/);
 assert.match(graduationRequirements(school),/연결된 요건: 전공선태/);
 assert.equal(graduationSummary(school,schoolCreditGroups(school)).areas[0].earned,3);
 assert.deepEqual(school,before);
});
