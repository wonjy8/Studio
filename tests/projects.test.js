import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,validateWorkspace,workspaceFileIds} from '../src/domain/workspace.js';
import {prepareProjects,addProject,switchProject,projectSnapshot} from '../src/domain/projects.js';
test('legacy workspace retains its production data and attachment links',()=>{
 const legacy=emptyWorkspace();legacy.project.name='Fictional production';
 legacy.contents.push({id:'shoot-one',name:'Interview',time:'09:00',location:'Set A',status:'check',script:true,scriptFile:'11111111-1111-1111-1111-111111111111'});
 const before=structuredClone(legacy);
 const state=prepareProjects(legacy);
 assert.equal(validateWorkspace(state),true);
 assert.deepEqual(state.contents,before.contents);
 assert.equal(state.project.name,before.project.name);
 assert.equal(state.project.id,'project-main');
});
test('project switching preserves independent data, icons and attachment ownership inputs',()=>{
 let state=prepareProjects(emptyWorkspace());
 state.project.name='Fictional A';state.project.icon='book';state.project.color='orange';
 state.refs.push({id:'r1',name:'Visual',notes:'',images:['/api/files/11111111-1111-1111-1111-111111111111']});
 const initial=projectSnapshot(state);
 state=addProject(state,{name:'Fictional B',icon:'camera',color:'blue'},'project-b');
 assert.equal(state.refs.length,0);assert.equal(state.project.icon,'camera');
 assert.equal(validateWorkspace(state),true);
 assert.equal(workspaceFileIds(state).length,1);
 state=switchProject(state,'project-main');
 assert.deepEqual(projectSnapshot(state),initial);
 state=switchProject(state,'project-b');
 assert.equal(state.project.name,'Fictional B');assert.equal(state.project.color,'blue');
 assert.equal(state.projects.length,1);
 assert.throws(()=>switchProject(state,'missing'));
});
test('reject nested workspaces, duplicate project IDs and unsafe icon metadata',()=>{
 const state=prepareProjects(emptyWorkspace());
 const other=projectSnapshot(state);
 assert.equal(validateWorkspace({...state,projects:[other]}),false);
 other.project.id='other';other.projects=[];
 assert.equal(validateWorkspace({...state,projects:[other]}),false);
 delete other.projects;other.project.icon='javascript:alert(1)';
 assert.equal(validateWorkspace({...state,projects:[other]}),false);
});
