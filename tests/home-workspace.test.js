import test from 'node:test';
import assert from 'node:assert/strict';
import {homeWorkspacePage} from '../src/features/home-workspace.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {projectNavigation} from '../src/patterns/navigation.js';

test('home workspace summarizes projects and offers personal document access',()=>{
 const state=emptyWorkspace();
 state.project={...state.project,id:'p1',name:'Project One',placeholder:false};
 state.contents=[{id:'s1',name:'Shoot One',time:'10:00',date:'2026-10-21'}];
 state.tasks=[{id:'t1',name:'Prepare camera',completed:false,date:'2026-10-21'}];
 state.projects=[{...emptyWorkspace(),project:{...emptyWorkspace().project,id:'p2',name:'Project Two',placeholder:false},contents:[],tasks:[]}];
 const html=homeWorkspacePage({state,account:{name:'종유'}});
 assert.match(html,/Project One/);
 assert.match(html,/Project Two/);
 assert.match(html,/Prepare camera/);
 assert.match(html,/data-view="document-workspace"/);
 assert.match(html,/data-project="p1"/);
});
test('home workspace is the first rail item and owns its own sidebar',()=>{
 const html=projectNavigation(emptyWorkspace(),'workspace-home',false,{});
 assert.match(html,/aria-label="홈 워크스페이스"/);
 assert.ok(html.indexOf('aria-label="홈 워크스페이스"')<html.indexOf('aria-label="프로덕션"'));
 assert.match(html,/대시보드/);
});
