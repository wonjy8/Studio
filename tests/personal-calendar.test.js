import {test} from 'node:test';import assert from 'node:assert/strict';import {calendarDateRange} from '../src/domain/personal-calendar.js';
test('personal calendar initially covers its whole local month including timezone and year boundaries',()=>{
 assert.deepEqual(calendarDateRange('Asia/Seoul',new Date('2026-12-31T16:00:00Z')),{today:'2027-01-01',start:'2027-01-01',end:'2027-02-01'});
 assert.deepEqual(calendarDateRange('America/Los_Angeles',new Date('2026-03-01T00:00:00Z')),{today:'2026-02-28',start:'2026-02-01',end:'2026-03-01'});
 assert.equal(calendarDateRange('UTC',new Date('2028-02-29T12:00:00Z')).end,'2028-03-01');
});
