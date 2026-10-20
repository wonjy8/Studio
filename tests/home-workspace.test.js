import test from 'node:test';
import assert from 'node:assert/strict';
import {homeWorkspacePage,homeSchedulePage,homeTasksPage} from '../src/features/home-workspace.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
import {projectNavigation} from '../src/patterns/navigation.js';
test('home workspace summarizes projects with nearby shoots on the left and QT on the right',()=>{
 const state=emptyWorkspace();
 state.project={...state.project,id:'p1',name:'Project One',placeholder:false};
 state.contents=[{id:'s1',name:'Shoot One',time:'10:00',date:'2026-10-21'}];
 state.tasks=[{id:'t1',name:'Prepare camera',completed:false,date:'2026-10-21'}];
 state.projects=[{...emptyWorkspace(),project:{...emptyWorkspace().project,id:'p2',name:'Project Two',placeholder:false},contents:[],tasks:[{id:'t2',name:'Done',completed:true}]}];
 const html=homeWorkspacePage({state,account:{name:'종유'}});
 assert.match(html,/Project One/);assert.match(html,/Project Two/);assert.match(html,/Prepare camera/);
 assert.ok(html.indexOf('home-upcoming-panel')<html.indexOf('data-home-qt'));assert.ok(html.indexOf('<h2>내 프로젝트</h2>')<html.indexOf('home-upcoming-panel'));assert.doesNotMatch(html,/data-personal-calendar|data-google-tasks/);
 assert.match(html,/home-command/);assert.match(html,/100% 완료/);assert.match(html,/0% 완료/);assert.match(html,/data-view="materials"/);assert.match(html,/data-view="scripture-prayers"/);assert.match(html,/data-home-qt/);assert.doesNotMatch(html,/data-view="document-workspace"|data-action="add-project"|개인 작업 공간/);assert.match(html,/data-project="p1"/);
 assert.doesNotMatch(html,/안녕하세요|프로젝트 현황을 살펴보고 개인 문서를 이어서 작업하세요/);
});
test('home workspace is the first rail item and owns its own sidebar',()=>{
 const html=projectNavigation(emptyWorkspace(),'workspace-home',false,{});
 assert.match(html,/aria-label="홈 워크스페이스"/);
 assert.ok(html.indexOf('aria-label="홈 워크스페이스"')<html.indexOf('aria-label="프로덕션"'));
 assert.match(html,/대시보드/);assert.doesNotMatch(html,/내 문서/);
});



test('home schedule and task entries include project context without exposing the wrong integration panel',()=>{
 const state=emptyWorkspace();state.project={...state.project,id:'project-one',name:'First'};state.contents=[{id:'s1',name:'First shoot',date:'2099-01-02',time:'10:00'}];state.tasks=[{id:'t1',name:'First task',completed:false,shootId:'s1'}];
 const other=emptyWorkspace();other.project={...other.project,id:'project-two',name:'Second'};other.tasks=[{id:'t1',name:'Second task',completed:true}];state.projects=[other];
 const schedule=homeSchedulePage({state}),tasks=homeTasksPage({state});
 assert.match(schedule,/First shoot/);assert.match(schedule,/data-home-open-project="project-one" data-home-project-view="schedule" data-home-date="2099-01-02"/);assert.match(schedule,/data-personal-calendar/);assert.doesNotMatch(schedule,/data-google-tasks|data-home-qt/);
 assert.match(tasks,/First task/);assert.match(tasks,/Second task/);assert.match(tasks,/First shoot/);assert.match(tasks,/data-home-open-project="project-two" data-home-project-view="tasks"/);assert.match(tasks,/data-google-tasks/);assert.doesNotMatch(tasks,/data-personal-calendar|data-home-qt/);
 for(const view of ['workspace-schedule','workspace-tasks']){const nav=projectNavigation(state,view,false,{});assert.match(nav,/aria-label="홈 메뉴"/);assert.match(nav,/data-view="workspace-schedule"/);assert.match(nav,/data-view="workspace-tasks"/);assert.doesNotMatch(nav,/aria-label="프로젝트 목록"/);}
});
