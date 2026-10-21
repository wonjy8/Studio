import test from 'node:test';
import assert from 'node:assert/strict';
import {projectIconCatalog,selectableProjectIcons,findProjectIcons,projectIconInfo} from '../src/design-system/icons/catalog.js';
import {projectIconPaths} from '../src/design-system/icons/paths.js';
import {icon} from '../src/design-system/primitives/icons.js';
import {ionIconAliases,ionIconPaths} from '../src/design-system/icons/ionicons.js';
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
 assert.match(html,/title="KakaoTalk"/);
 assert.match(html,/popover class="project-icon-popover"/);
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

test('every selectable icon uses a real filled vector and legacy identities stay valid',()=>{
 assert.ok(selectableProjectIcons.length>500);
 for(const item of selectableProjectIcons){const svg=icon(item.id,{solid:true});assert.match(svg,/fill="currentColor"/);assert.match(svg,/stroke="none"/);}
 const state=emptyWorkspace();state.project.icon='tabler-device-desktop-search';assert.ok(validateWorkspace(state));
});
test('equipment workspace camcorder uses the paired Ionicons outline and filled variants',()=>{
 const iconName=ionIconAliases.camcorder;
 const outline=icon('camcorder');
 const filled=icon('camcorder',{solid:true});
 assert.notEqual(outline,filled);
 assert.ok(outline.includes(ionIconPaths[iconName].outline));
 assert.ok(filled.includes(ionIconPaths[iconName].filled));
 assert.match(outline,/fill="none" stroke="currentColor"/);
 assert.match(filled,/fill="currentColor" stroke="none"/);
 assert.match(outline,/aria-hidden="true" focusable="false"/);
});


test('gratitude thumbs-up icon uses paired Ionicons variants',()=>{
 const outline=icon('thumbsUp'),filled=icon('thumbsUp',{solid:true});
 assert.ok(ionIconAliases.thumbsUp);
 assert.ok(outline.includes(ionIconPaths['thumbs-up'].outline));
 assert.ok(filled.includes(ionIconPaths['thumbs-up'].filled));
 assert.match(ionIconPaths['thumbs-up'].outline,/stroke:currentColor/);
 assert.notEqual(outline,filled);
});

test('calendar outline fills its tiny date marks while preserving the line frame',()=>{
 const outline=icon('calendar'),filled=icon('calendar',{solid:true});
 assert.ok(outline.includes(ionIconPaths.calendar.outline));
 assert.ok(filled.includes(ionIconPaths.calendar.filled));
 assert.equal((ionIconPaths.calendar.outline.match(/fill="currentColor" stroke="none"/g)||[]).length,9);
 assert.match(ionIconPaths.calendar.outline,/<rect fill="none" stroke="currentColor"/);
 assert.notEqual(outline,filled);
});

test('prayer hands use upright joined palms and diagonal cuffs in both variants',()=>{
 const outline=icon('prayerHands'),filled=icon('prayerHands',{solid:true});
 assert.ok(ionIconPaths['prayer-hands'].outline.includes('M256 42 C242 40'));
 assert.ok(ionIconPaths['prayer-hands'].filled.includes('M256 42 C242 40'));
 assert.equal((ionIconPaths['prayer-hands'].outline.match(/stroke-width:32px/g)||[]).length,3);
 assert.equal((ionIconPaths['prayer-hands'].filled.match(/stroke-width:32px/g)||[]).length,2);
 assert.ok(ionIconPaths['prayer-hands'].outline.includes('M93 400 L183 475'));
 assert.ok(ionIconPaths['prayer-hands'].filled.includes('M93 400 L183 475'));
 assert.ok(ionIconPaths['prayer-hands'].filled.includes('stroke:#fff'));
 assert.ok(outline.includes(ionIconPaths['prayer-hands'].outline));
 assert.ok(filled.includes(ionIconPaths['prayer-hands'].filled));
});

 test('connection chain icon registers both real Ionicons variants instead of fallback artwork',()=>{
  assert.equal(ionIconAliases.link,'link');assert.notEqual(ionIconPaths.link.outline,ionIconPaths.link.filled);
  assert.ok(icon('link').includes(ionIconPaths.link.outline));assert.ok(icon('link',{solid:true}).includes(ionIconPaths.link.filled));
  assert.match(icon('link'),/viewBox="0 0 512 512"/);
 });
