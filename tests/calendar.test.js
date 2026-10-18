import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,dateKey,dateObject,addDays,shiftDate,validDate,minutes,calendarEvents,eventLanes,validSchedule} from '../src/domain/calendar.js';
import {emptyWorkspace,validateWorkspace} from '../src/domain/workspace.js';
import {addTask,renameTask} from '../src/features/tasks.js';
import {applyCommands} from '../src/domain/commands.js';
import {prepareProjects} from '../src/domain/projects.js';

test('calendar ranges cover adjacent months, leap days, Sunday weeks and clamped navigation',()=>{
 assert.equal(validDate('2024-02-29'),true);for(const date of ['2026-02-29','2026-04-31','2026-13-01','bad'])assert.equal(validDate(date),false,date);
 assert.equal(dateKey(dateObject('2026-01-31')),'2026-01-31');assert.equal(shiftDate('2026-01-31','month',1),'2026-02-28');assert.equal(shiftDate('2024-01-31','month',1),'2024-02-29');assert.equal(addDays('2026-12-31',1),'2027-01-01');
 const month=calendarDays('2026-10-18');assert.equal(month[0],'2026-09-27');assert.equal(month.length,35);assert.equal(month.at(-1),'2026-10-31');assert.deepEqual(calendarDays('2026-11-01','week'),['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07']);assert.deepEqual(calendarDays('2026-10-18','day'),['2026-10-18']);
});
test('calendar merges tasks and individual shoots, retains undated tasks and legacy project dates',()=>{
 const state=emptyWorkspace();state.project.date='2026-10-18';state.contents=[{id:'legacy',name:'Legacy',time:'09:00–11:00'},{id:'individual',name:'Individual',date:'2026-10-19',time:'10:30'}];state.tasks=[{id:'task',name:'Ready',date:'2026-10-18',time:'09:30',completed:true},{id:'undated',name:'Undated',completed:false}];
 const events=calendarEvents(state);assert.equal(events.find(e=>e.id==='legacy').date,'2026-10-18');assert.equal(events.find(e=>e.id==='legacy').end,660);assert.equal(events.find(e=>e.id==='individual').date,'2026-10-19');assert.equal(events.find(e=>e.id==='undated').date,'');assert.equal(events.find(e=>e.id==='task').completed,true);assert.equal(minutes('24:00'),null);
});
test('overlapping events receive independent lanes and disjoint groups reset',()=>{
 const input=[{id:'a',start:540,end:660},{id:'b',start:570,end:600},{id:'c',start:600,end:700},{id:'d',start:700,end:720}];const original=structuredClone(input),events=eventLanes(input);assert.deepEqual(input,original);assert.equal(events.find(e=>e.id==='a').columns,2);assert.notEqual(events.find(e=>e.id==='a').lane,events.find(e=>e.id==='b').lane);assert.equal(events.find(e=>e.id==='d').columns,1);assert.equal(events.find(e=>e.id==='d').lane,0);
});
test('task due dates edit and clear without changing completion, with server workspace validation',()=>{
 let state=prepareProjects(emptyWorkspace());state.tasks=addTask([], 'Dated task','t',{date:'2026-10-18',time:'12:30'});state.tasks[0].completed=true;assert.ok(validateWorkspace(state));state.tasks=renameTask(state.tasks,'t','Renamed',{date:'2026-10-19',time:''});assert.equal(state.tasks[0].completed,true);assert.equal(state.tasks[0].time,undefined);assert.ok(validateWorkspace(state));state.tasks=renameTask(state.tasks,'t','Undated',{date:'',time:''});assert.equal(state.tasks[0].date,undefined);
 for(const fields of [{date:'2026-02-30'},{time:'09:30'},{date:'2026-10-18',time:'25:30'}]){assert.equal(validSchedule(fields),false);assert.throws(()=>addTask([], 'Invalid','bad',fields));state.tasks[0]={...state.tasks[0],...fields};assert.equal(validateWorkspace(state),false);delete state.tasks[0].date;delete state.tasks[0].time;}
 const result=applyCommands(state,state.project.id,[{operation:'add_shoot',values:{name:'Dated shoot',date:'2026-10-20'}}]).state;assert.equal(result.contents[0].date,'2026-10-20');assert.ok(validateWorkspace(result));result.contents[0].date='2026-02-30';assert.equal(validateWorkspace(result),false);
});
