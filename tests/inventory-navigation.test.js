import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routePath,parseRoute,routeBelongsToAccount} from '../src/app/routes.js';
import {projectNavigation} from '../src/patterns/navigation.js';
import {appShell} from '../src/app/shell.js';
import {emptyWorkspace} from '../src/domain/workspace.js';
test('organization collection URLs retain account, section and history identity',()=>{
 for(const view of ['inventory','inventory-outstanding','inventory-history']){
  const path=routePath({view,username:'fictional.operator',inventoryContainerId:'fictional-org'}),route=parseRoute(path);
  assert.equal(route.valid,true);assert.equal(route.view,view);assert.equal(route.inventoryContainerId,'fictional-org');assert.equal(route.username,'fictional.operator');assert.match(path,/\/inventory\/organizations\/fictional-org\//);
  assert.equal(routeBelongsToAccount(route,{username:'outsider'}),false);
 }
 for(const path of ['/inventory/organizations/bad%2Fid/items','/inventory/organizations/a/unknown','/inventory/organizations/a/items/extra'])assert.equal(parseRoute(path).valid,false);
 const admin=routePath({view:'admin-organizations',username:'fictional.admin'});assert.equal(admin,'/fictional.admin/admin/organizations');assert.equal(parseRoute(admin).view,'admin-organizations');
 const ordinary=projectNavigation(emptyWorkspace(),'home',false,{});assert.doesNotMatch(ordinary,/data-view="admin-organizations"/);
 const html=appShell({state:emptyWorkspace(),view:'admin-organizations',body:'',session:{isAdmin:true}});assert.match(html,/data-view="admin"/);assert.doesNotMatch(html,/data-view="admin-organizations"/);assert.doesNotMatch(html,/class="project-tabs"/);
});
test('equipment workspace paths retain account scope and never become project tabs',()=>{
 for(const [view,tail]of [['inventory','items'],['inventory-outstanding','outstanding'],['inventory-history','history']]){
  const path=routePath({view,username:'fictional.operator',project:{id:'project',name:'Fictional'}});assert.equal(path,'/fictional.operator/inventory/'+tail);const route=parseRoute(path);assert.equal(route.view,view);assert.equal(routeBelongsToAccount(route,{username:'fictional.operator'}),true);assert.equal(routeBelongsToAccount(route,{username:'outsider'}),false);
  const html=appShell({state:emptyWorkspace(),view,body:'',session:{account:{username:'fictional.operator'}}});assert.match(html,/장비 관리/);assert.doesNotMatch(html,/class="project-tabs"/);assert.match(html,/aria-label="장비 관리 메뉴"/);
 }
 assert.equal(parseRoute('/fictional.operator/inventory/unknown').valid,false);
});
test('inventory navigation has three clear entries and administrator uses a separate shield',()=>{
 const state=emptyWorkspace(),html=projectNavigation(state,'inventory',false,{isAdmin:true});for(const name of ['전체 장비','장비 관리','반출 현황','반출·반납 내역'])assert.ok(html.includes(name));assert.match(html,/aria-label="자료 워크스페이스"/);assert.match(html,/aria-label="관리자 워크스페이스"/);const admin=html.match(/<button[^>]*aria-label="관리자 워크스페이스"[\s\S]*?<\/button>/)?.[0];assert.match(admin,/M12 3 4 6v6/);assert.doesNotMatch(projectNavigation(state,'inventory',false,{}),/aria-label="관리자 워크스페이스"/);
});
