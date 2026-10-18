import test from 'node:test';
import assert from 'node:assert/strict';
import {signupPage} from '../src/pages/signup.js';
import {settingsPage} from '../src/pages/settings.js';
import {projectNavigation,projectTabs} from '../src/patterns/navigation.js';
import {appShell} from '../src/app/shell.js';
import {accountMembersPanel,adminPanel} from '../src/features/accounts.js';
const state={project:{id:'p1',name:'Synthetic Project',color:'blue',icon:'production'},projects:[]};
test('signup is concise and global settings no longer duplicates project editing',()=>{assert.match(signupPage(),/<h1 id="signup-title">회원가입<\/h1>/);assert.doesNotMatch(signupPage(),/YOU’RE INVITED|환영|촬영 준비를 시작/);const html=settingsPage(state,{username:'fictional',isAdmin:false});assert.match(html,/@fictional/);assert.doesNotMatch(html,/data-action="project-settings"/);assert.equal(projectTabs.at(-1)[0],'project-settings');});
test('settings sidebar replaces projects and exposes admin only to admin session',()=>{const regular=projectNavigation(state,'settings',false,{isAdmin:false});assert.match(regular,/설정 메뉴/);assert.doesNotMatch(regular,/data-project=/);assert.doesNotMatch(regular,/data-view="admin"/);assert.match(projectNavigation(state,'settings',false,{isAdmin:true}),/data-view="admin"/);const glyph=html=>html.match(/aria-pressed="(?:true|false)">(.+?)<\/button>/s)[1];assert.equal(glyph(regular),glyph(projectNavigation(state,'home',false)));});
test('global header avoids ambiguous shoot action and member/admin forms retain safeguards',()=>{assert.doesNotMatch(appShell({state,view:'home',body:'',modal:'',session:{}}),/add-content/);assert.match(accountMembersPanel('p1'),/계정 검색/);const admin=adminPanel();assert.doesNotMatch(admin,/password"/);assert.match(admin,/property-settings/);assert.match(admin,/data-admin-users/);});

test('self profile uses authenticated nested identity and administrators have separate equipment view',()=>{const html=settingsPage(state,{account:{username:'fictional-crew',name:'Fictional Crew'},isAdmin:false});assert.match(html,/Fictional Crew/);assert.match(html,/@fictional-crew/);assert.match(html,/data-account-profile/);assert.match(signupPage(),/name="name" maxlength="80"/);const nav=projectNavigation(state,'admin-equipment',false,{isAdmin:true});assert.match(nav,/data-view="admin-equipment"/);assert.doesNotMatch(projectNavigation(state,'settings',false,{isAdmin:false}),/data-view="admin-equipment"/);});

test('administrator workspace has separate rail, sidebar menus and header',()=>{
 const admin=projectNavigation(state,'admin-equipment',true,{isAdmin:true});assert.match(admin,/aria-label="관리자 워크스페이스" title="관리자 워크스페이스"/);assert.match(admin,/<h2>관리자 워크스페이스<\/h2>/);assert.match(admin,/aria-label="관리자 메뉴"/);assert.match(admin,/data-view="admin-equipment" aria-current="page"/);assert.doesNotMatch(admin,/data-settings-section/);assert.match(admin,/<span>장비<\/span>/);assert.match(admin,/aria-label="프로젝트 목록 닫기"/);
 assert.match(appShell({state,view:'admin',body:'',modal:'',session:{isAdmin:true}}),/<h1>관리자 워크스페이스<\/h1>/);assert.doesNotMatch(projectNavigation(state,'settings',false,{isAdmin:false}),/관리자 워크스페이스|초대 링크|data-settings-section="invitations"/);
});
test('settings sections select independently and keep account, storage and integration bodies separate',()=>{
 for(const section of ['account','connections','data']){
  const session={isAdmin:true,settingsSection:section,account:{username:'fictional-user',name:'Fictional User'}};
  const nav=projectNavigation(state,'settings',false,session);assert.match(nav,new RegExp('data-settings-section="'+section+'" aria-current="page"'));const menus=nav.match(/<nav class="project-list" aria-label="설정 메뉴">([\s\S]*?)<\/nav>/)[1];assert.equal((menus.match(/data-settings-section=/g)||[]).length,3);assert.doesNotMatch(menus,/data-view="admin/);assert.deepEqual([...menus.matchAll(/data-settings-section="([^"]+)"/g)].map(match=>match[1]),['account','connections','data']);assert.deepEqual([...menus.matchAll(/<span>([^<]+)<\/span>/g)].map(match=>match[1]),['계정 설정','외부 앱 연결','데이터']);assert.doesNotMatch(menus,/초대 링크|invitations|사용자 관리|관리자 워크스페이스/);
  const body=settingsPage(state,session);if(section==='account'){assert.match(body,/data-account-profile/);assert.match(body,/data-action="logout"/);assert.doesNotMatch(body,/NAS 저장/);}else{assert.doesNotMatch(body,/data-account-profile|data-action="logout"/);if(section==='data'){assert.match(body,/저장 위치/);assert.match(body,/NAS/);}else assert.doesNotMatch(body,/NAS 저장/);}assert.doesNotMatch(body,/data-view="admin/);
 }
 const regular=projectNavigation(state,'settings',false,{settingsSection:'connections'});assert.equal((regular.match(/data-settings-section=/g)||[]).length,3);assert.doesNotMatch(regular,/invitations/);assert.match(settingsPage(state,{settingsSection:'invitations'}),/<h2>계정 설정<\/h2>/);
});

test('admin and global settings secondary menus never mix for either account role',()=>{
 for(const isAdmin of [false,true]){
  const html=projectNavigation(state,'settings',true,{isAdmin}),secondary=html.slice(html.indexOf('<section class="project-sidebar">'));
  assert.doesNotMatch(secondary,/data-view="admin|관리자 메뉴|초대 링크|invitations/);assert.equal((secondary.match(/data-settings-section=/g)||[]).length,3);
  assert.doesNotMatch(settingsPage(state,{isAdmin,settingsSection:'invitations'}),/초대 링크|가입 초대/);
 }
 for(const view of ['admin','admin-equipment']){
  const html=projectNavigation(state,view,true,{isAdmin:true}),secondary=html.slice(html.indexOf('<section class="project-sidebar">'));
  assert.match(secondary,/aria-label="관리자 메뉴"/);assert.doesNotMatch(secondary,/data-settings-section|설정 메뉴|외부 앱 연결|초대 링크/);
  assert.deepEqual([...secondary.matchAll(/data-view="([^"]+)"/g)].map(match=>match[1]),['admin','admin-equipment']);
 }
});
