import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routePath,routeBelongsToAccount} from '../src/app/routes.js';
import {projectNavigation} from '../src/patterns/navigation.js';
import {appShell} from '../src/app/shell.js';
test('managed project URL keeps actor namespace and compound target identity without owner impersonation',()=>{
 const managedProject={ownerId:'fictional-other-owner',projectId:'same-project'};
 const url=routePath({view:'admin-projects',username:'fictional-actor',managedProject});const route=parseRoute(url);
 assert.equal(route.view,'admin-projects');assert.equal(route.username,'fictional-actor');assert.deepEqual(route.managedProject,managedProject);assert.equal(route.projectId,undefined);assert.equal(routeBelongsToAccount(route,{username:'fictional-actor'}),true);assert.equal(routeBelongsToAccount(route,{username:'fictional-other-owner'}),false);
 assert.equal(parseRoute('/fictional-actor/admin/projects?managedOwner=..&managedProject=same-project').managedProject,undefined);
 const state={project:{id:'fictional-own',name:'Fictional Own'},projects:[]};const session={isAdmin:true,canManageProjects:true};assert.match(projectNavigation(state,'admin-projects',false,session),/data-view="admin-projects"[^>]*aria-current="page"/);assert.doesNotMatch(projectNavigation(state,'admin-projects',false,{isAdmin:true}),/data-view="admin-projects"/);assert.doesNotMatch(appShell({state,view:'admin-projects',body:'',session}),/aria-label="프로젝트 메뉴"/);
});
test('administrator settings retain legacy deep links and hide the entire privileged group from members',()=>{
 const state={project:{id:'p',name:'Fictional'},projects:[]};
 for(const [path,view]of [['users','admin'],['invitations','admin-invitations'],['organizations','admin-organizations'],['projects','admin-projects']]){
  for(const prefix of ['','/fictional'])assert.equal(parseRoute(prefix+'/admin/'+path).view,view);
  assert.equal(routePath({view,username:'fictional'}),'/fictional/settings/'+path);
  const html=projectNavigation(state,view,false,{isAdmin:true,canManageProjects:true});assert.match(html,/aria-label="설정 메뉴"/);assert.match(html,/data-view="settings" aria-label="설정"[^>]*aria-pressed="true"/);assert.doesNotMatch(html,/관리자 워크스페이스/);
 }
 const member=projectNavigation(state,'settings',false,{});assert.doesNotMatch(member,/data-admin-settings-divider|data-view="admin/);
 const admin=projectNavigation(state,'settings',false,{isAdmin:true,canManageProjects:true});assert.ok(admin.indexOf('data-settings-section="data"')<admin.indexOf('data-admin-settings-divider'));assert.ok(admin.indexOf('data-admin-settings-divider')<admin.indexOf('data-view="admin"'));
});
