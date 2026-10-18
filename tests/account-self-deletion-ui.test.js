import test from 'node:test';
import assert from 'node:assert/strict';
import {selfDeletionPanel,selfDeletionDraftPending,selfDeletionCanLeave} from '../src/features/account-self-deletion.js';
import {settingsPage} from '../src/pages/settings.js';
test('self deletion starts with explicit preview and no credential form or account target',()=>{
 const html=selfDeletionPanel({account:{id:'private-target',username:'fictional'}});
 assert.match(html,/data-self-deletion-preview/);assert.match(html,/앱에서 복구할 수 없습니다/);
 assert.doesNotMatch(html,/private-target|type="password"|data-self-deletion-form/);
 assert.equal(selfDeletionDraftPending(),false);assert.equal(selfDeletionCanLeave(),true);
});
test('protected roles get human guidance and panel appears only in account settings',()=>{
 assert.match(selfDeletionPanel({siteRole:'super_admin'}),/최고 관리자 계정은 직접 삭제할 수 없습니다/);
 assert.match(selfDeletionPanel({siteRole:'admin'}),/관리자 권한 해제/);
 assert.match(settingsPage({}, {settingsSection:'account'}),/data-self-deletion-preview/);
 assert.doesNotMatch(settingsPage({}, {settingsSection:'data'}),/data-self-deletion-preview/);
});
test('logout and deletion share a danger box while app version belongs to data settings',()=>{
 const account=settingsPage({}, {settingsSection:'account',appVersion:'1234567890abcdef1234567890abcdef12345678'});assert.ok(account.indexOf('data-action="logout"')<account.indexOf('data-self-deletion-preview'));assert.match(account,/<div class="account-danger-box">[\s\S]*data-action="logout"[\s\S]*data-self-deletion-preview/);assert.doesNotMatch(account,/data-app-version/);const data=settingsPage({}, {settingsSection:'data',appVersion:'1234567890abcdef1234567890abcdef12345678'});assert.match(data,/data-app-version title="1234567890abcdef1234567890abcdef12345678">1234567</);assert.doesNotMatch(data,/data-action="logout"|data-self-deletion/);
});
