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
