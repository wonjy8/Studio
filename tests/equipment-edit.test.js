import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentAssignmentValues,equipmentEditForm,equipmentAssignedToMember} from '../src/features/equipment-edit.js';
const members=[{id:'crew-a',name:'Fictional Crew A'},{id:'crew-b',name:'Fictional Crew B'}];
test('linked assignment resolves labels by current member IDs and ignores stale/manual labels',()=>{assert.deepEqual(equipmentAssignmentValues({ownerMode:'member',ownerMemberId:'crew-a',owner:'stale',assigneeMode:'member',assigneeMemberId:'crew-b',assignee:'stale'},members),{ownerMemberId:'crew-a',owner:'Fictional Crew A',assigneeMemberId:'crew-b',assignee:'Fictional Crew B'});});
test('manual assignment explicitly unlinks even when text equals a member name, and empty is valid',()=>{assert.deepEqual(equipmentAssignmentValues({ownerMode:'manual',ownerMemberId:'crew-a',owner:'Fictional Crew A',assigneeMode:'manual',assigneeMemberId:'crew-b',assignee:''},members),{ownerMemberId:null,owner:'Fictional Crew A',assigneeMemberId:null,assignee:''});});
test('rejects missing mode, foreign member IDs and oversized manual values',()=>{assert.throws(()=>equipmentAssignmentValues({},members));assert.throws(()=>equipmentAssignmentValues({ownerMode:'member',ownerMemberId:'foreign',assigneeMode:'manual'},members),/현재 프로젝트/);assert.throws(()=>equipmentAssignmentValues({ownerMode:'manual',owner:'x'.repeat(2001),assigneeMode:'manual'},members),/2000/);});
test('form distinguishes linked/manual modes with connected labels and escaped private text',()=>{const html=equipmentEditForm({id:'gear-one',name:'Fictional <Camera>',ownerMemberId:'crew-a',owner:'Fictional Crew A',assigneeMemberId:null,assignee:'Manual <Crew>'},members);assert.match(html,/Fictional &lt;Camera&gt;/);assert.match(html,/Manual &lt;Crew&gt;/);assert.match(html,/name="ownerMemberId" required/);assert.match(html,/name="assigneeMemberId" disabled/);for(const id of ['owner-mode','owner-member','owner-manual','assignee-mode','assignee-member','assignee-manual']){assert.match(html,new RegExp('for="equipment-edit-'+id+'"'));assert.match(html,new RegExp('id="equipment-edit-'+id+'"'));}});
test('member equipment respects explicit identities and keeps only omitted-id legacy name matching',()=>{
 const member={id:'fictional-person',name:'Fictional Person'};
 assert.equal(equipmentAssignedToMember({assignee:member.name,assigneeMemberId:null},member),false);
 assert.equal(equipmentAssignedToMember({assignee:member.name,assigneeMemberId:'fictional-other'},member),false);
 assert.equal(equipmentAssignedToMember({assignee:'Old name',assigneeMemberId:member.id},member),true);
 assert.equal(equipmentAssignedToMember({assignee:member.name},member),true);
});
