import test from 'node:test';
import assert from 'node:assert/strict';
import {projectIconCatalog,findProjectIcons,projectIconInfo} from '../src/design-system/icons/catalog.js';
import {projectIconPaths} from '../src/design-system/icons/paths.js';
import {icon} from '../src/design-system/primitives/icons.js';
import {projectForm,projectIconPage,iconPageSize} from '../src/features/projects/project-form.js';
import {emptyWorkspace,validateWorkspace,projectIcons} from '../src/domain/workspace.js';

test('catalog has 1900 stable unique ids and matching safe vectors',()=>{
 assert.equal(projectIconCatalog.length,1900);
 assert.equal(new Set(projectIcons).size,1900);
 for(const item of projectIconCatalog){
  assert.match(item.id,/^[a-z0-9-]+$/);
  const svg=icon(item.id);
  assert.match(svg,/<svg/);
  assert.doesNotMatch(svg,/<script|on\w+=|href=|<foreignObject/i);
  if(item.id.startsWith('tabler-')||item.id==='brand-kakaotalk')assert.ok(projectIconPaths[item.id]);
 }
 for(const id of ['production','play','book','camera','folder','sparkle'])assert.ok(projectIconInfo(id));
});
test('SNS and production aliases are searchable with categories and multiword queries',()=>{
 for(const [query,id] of [['유튜브','tabler-brand-youtube'],['Instagram','tabler-brand-instagram'],['페이스북','tabler-brand-facebook'],['카카오톡','brand-kakaotalk'],['카메라','camera']])assert.ok(findProjectIcons(query).some(x=>x.id===id));
 assert.ok(findProjectIcons('brand youtube','브랜드 · SNS').some(x=>x.id==='tabler-brand-youtube'));
 assert.equal(findProjectIcons('zzzz-no-icon').length,0);
});
test('picker caps DOM size, clamps pagination and retains out-of-page saved icon',()=>{
 assert.equal(projectIconPage().items.length,iconPageSize);
 assert.equal(projectIconPage('', '', -3).page,0);
 const end=projectIconPage('','',1000);assert.equal(end.page,end.pages-1);
 assert.equal(projectIconPage('no-icon-found').pages,1);
 const html=projectForm({name:'Fictional project',icon:'brand-kakaotalk',color:'blue'});
 assert.match(html,/name="icon" value="brand-kakaotalk"/);
 assert.match(html,/선택:.*KakaoTalk/);
 assert.equal((html.match(/name="project-icon-choice"/g)||[]).length,48);
 assert.match(html,/for="project-icon-search"/);
});
test('workspace validation accepts catalog identities and rejects arbitrary icon markup',()=>{
 const state=emptyWorkspace();state.project.icon='brand-kakaotalk';assert.ok(validateWorkspace(state));
 state.project.icon='tabler-brand-youtube';assert.ok(validateWorkspace(state));
 state.project.icon='<script>alert(1)</script>';assert.equal(validateWorkspace(state),false);
});
test('settings and creation forms can coexist with unique labelled control ids',()=>{
 const project={name:'Fictional project',icon:'camera',color:'blue'};
 const settings=projectForm(project),creation=projectForm(project,true),combined=settings+creation;
 const ids=[...combined.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const suffix of ['name','description','icon-search','icon-category','date','time','location']){
  for(const [html,prefix] of [[settings,'project'],[creation,'new-project']]){
   assert.ok(html.includes(`id="${prefix}-${suffix}"`));
   assert.ok(html.includes(`for="${prefix}-${suffix}"`));
  }
 }
});
