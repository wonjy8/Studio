import test from 'node:test';
import assert from 'node:assert/strict';
import {projectNavigation} from '../src/patterns/navigation.js';
import {appShell} from '../src/app/shell.js';
const state={project:{id:'same',name:'Fictional Own',color:'blue',icon:'folder'},projects:[]};const projects=[{ownerId:'source-a',projectId:'same',name:'Fictional A'},{ownerId:'source-b',projectId:'same',name:'Fictional B'}];
test('shared navigation selects owner/project identity while own same ID remains unselected',()=>{const html=projectNavigation(state,'shared',false,{sharedProjects:projects,activeSharedProject:projects[1]});assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.match(html,/data-shared-owner="source-b"[^>]*aria-current="page"/);assert.doesNotMatch(html,/data-project="same"[^>]*aria-current/);assert.match(html,/aria-label="프로덕션"[^>]*aria-pressed="true"/);assert.match(html,/aria-label="설정"[^>]*aria-pressed="false"/);});
test('settings excludes shared list and keeps only the primary admin shortcut; shared header uses project identity',()=>{const html=projectNavigation(state,'settings',false,{isAdmin:true,sharedProjects:projects});assert.doesNotMatch(html,/data-open-shared/);assert.match(html,/data-view="admin"/);assert.doesNotMatch(html,/data-view="admin-equipment"/);assert.doesNotMatch(html,/data-settings-section="invitations"|초대 링크/);assert.doesNotMatch(html,/aria-label="관리자 워크스페이스"/);assert.match(html,/data-admin-settings-divider/);assert.match(appShell({state,view:'shared',body:'',modal:'',session:{sharedProjects:projects,sharedProjectName:'Fictional B'}}),/<h1>Fictional B<\/h1>/);});
test('failed shared list exposes retry instead of false empty success',()=>{const html=projectNavigation(state,'home',false,{sharedListError:'Fictional failure',sharedProjects:[]});assert.match(html,/data-action="refresh-shared"/);assert.match(html,/Fictional failure/);assert.doesNotMatch(html,/초대받은 프로젝트가 없습니다/);});

test('shared project group is hidden when empty and labelled consistently when present',()=>{
 const empty=projectNavigation(state,'home',false,{sharedProjects:[]});assert.match(empty,/data-shared-projects hidden/);assert.doesNotMatch(empty,/프로젝트가 없습니다/);
 const populated=projectNavigation(state,'home',false,{sharedProjects:projects});assert.match(populated,/aria-label="공유 프로젝트"/);assert.doesNotMatch(populated,/data-shared-projects hidden/);
});
