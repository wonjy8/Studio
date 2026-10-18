import test from 'node:test';
import assert from 'node:assert/strict';
import {taskName,addTask,renameTask,taskEditForm,tasksList} from '../src/features/tasks.js';
test('adding task trims name without mutating existing tasks or their completion',()=>{const original=[{id:'existing',name:'Fictional ready item',completed:true}];const result=addTask(original,'  Fictional new item  ','new');assert.deepEqual(original,[{id:'existing',name:'Fictional ready item',completed:true}]);assert.deepEqual(result[1],{id:'new',name:'Fictional new item',completed:false});assert.equal(result[0].completed,true);});
test('renaming preserves ID/completion and does not mutate source or unrelated item',()=>{const original=[{id:'one',name:'Fictional name',completed:true},{id:'two',name:'Other fictional name',completed:false}];const renamed=renameTask(original,'one',' Updated fictional name ');assert.deepEqual(renamed[0],{id:'one',name:'Updated fictional name',completed:true});assert.equal(renamed[1],original[1]);assert.equal(original[0].name,'Fictional name');assert.deepEqual(renameTask(renamed,'one','Fictional name'),original);});
test('invalid edits/adds fail without changing task collection',()=>{const original=[{id:'one',name:'Fictional',completed:false}];assert.throws(()=>renameTask(original,'one','  '));assert.throws(()=>renameTask(original,'missing','Valid'));assert.throws(()=>taskName('x'.repeat(2001)));assert.throws(()=>addTask(original,'Valid','one'));assert.throws(()=>addTask(Array.from({length:2000},(_,i)=>({id:String(i)})),'Valid','new'));assert.deepEqual(original,[{id:'one',name:'Fictional',completed:false}]);});
test('task edit and list expose named keyboard buttons, connected labels and escaped text',()=>{const task={id:'one',name:'Fictional <ready>',completed:true};const form=taskEditForm(task),list=tasksList([task]);assert.match(form,/for="task-edit-name"/);assert.match(form,/id="task-edit-name"/);assert.match(form,/value="Fictional &lt;ready&gt;"/);assert.match(list,/data-edit-task="one"/);assert.match(list,/data-task="one" checked/);assert.match(list,/aria-label="Fictional &lt;ready&gt; 편집"/);assert.match(tasksList(),/등록된 할 일이 없습니다/);});

test('reminder dates use local calendar days, Korean times and completion-aware overdue state',async()=>{
 const {taskDue}=await import('../src/features/tasks.js'),now=new Date(2026,9,18,16,30);
 assert.deepEqual(taskDue({date:'2026-10-19',time:'22:00'},now),{label:'내일 오후 10:00',overdue:false});
 assert.deepEqual(taskDue({date:'2026-10-16',time:'16:00'},now),{label:'그저께 오후 4:00',overdue:true});
 assert.deepEqual(taskDue({date:'2026-10-18'},now),{label:'오늘',overdue:false});
 assert.equal(taskDue({date:'2026-10-18',time:'16:29'},now).overdue,true);
 assert.equal(taskDue({date:'2026-10-18',time:'16:31'},now).overdue,false);
 assert.equal(taskDue({date:'2026-10-16',completed:true},now).overdue,false);
 assert.equal(taskDue({date:'2026-10-19',time:'00:00'},now).label,'내일 오전 12:00');
 assert.equal(taskDue({date:'2026-10-19',time:'12:00'},now).label,'내일 오후 12:00');
 assert.equal(taskDue({date:'2026-10-31'},now).label,'2026. 10. 31');
 assert.deepEqual(taskDue({},now),{label:'',overdue:false});
});
test('flags survive task edits and workspace validation accepts only boolean flags',async()=>{
 const {emptyWorkspace,validateWorkspace}=await import('../src/domain/workspace.js');
 const state=emptyWorkspace();state.tasks=[{id:'flag',name:'Flagged task',completed:false,flagged:true}];
 state.tasks=renameTask(state.tasks,'flag','Renamed task',{date:'2026-10-19'});assert.equal(state.tasks[0].flagged,true);assert.equal(validateWorkspace(state),true);
 assert.match(tasksList(state.tasks),/aria-pressed="true"/);state.tasks[0].flagged='true';assert.equal(validateWorkspace(state),false);
});
