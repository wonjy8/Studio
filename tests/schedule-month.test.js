import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localCalendarMonth} from '../src/features/schedule-month.js';
test('calendar defaults to local month at positive and negative timezone boundaries',()=>{
 const moduleUrl=new URL('../src/features/schedule-month.js',import.meta.url).href;
 for(const [tz,instant,expected] of [
  ['Asia/Seoul','2026-10-31T15:30:00Z','2026-11'],
  ['America/Los_Angeles','2026-11-01T06:30:00Z','2026-10'],
  ['Pacific/Kiritimati','2026-12-31T10:30:00Z','2027-01'],
  ['Pacific/Honolulu','2027-01-01T09:30:00Z','2026-12']
 ]){
  const code=`import {localCalendarMonth} from ${JSON.stringify(moduleUrl)}; console.log(localCalendarMonth(new Date(${JSON.stringify(instant)})))`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:tz},encoding:'utf8'}).trim(),expected,tz);
 }
 assert.match(localCalendarMonth(new Date(2026,0,15)),/^2026-01$/);
});
