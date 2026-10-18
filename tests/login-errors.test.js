import test from 'node:test';import assert from 'node:assert/strict';
import {loginFailureMessage} from '../src/features/login-errors.js';import {request} from '../src/integrations/api.js';
test('login failures distinguish transport facts and accepted-login session failures without exposing account state',()=>{
 assert.match(loginFailureMessage({status:401},'login'),/로그인 정보를 확인/);
 assert.match(loginFailureMessage({status:401},'session'),/접속 상태를 유지하지/);
 assert.match(loginFailureMessage({status:403}),/접속 주소/);
 assert.match(loginFailureMessage({status:429}),/잠시 제한/);
 assert.match(loginFailureMessage({status:503}),/로그인 서버/);
 assert.match(loginFailureMessage(new TypeError('private network details')),/연결하지/);
 assert.doesNotMatch(loginFailureMessage({status:401,message:'private account disabled'}),/private|disabled|정지/);
});
test('non-JSON service errors retain HTTP status without rendering upstream HTML',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>new Response('<html>private upstream details</html>',{status:503,headers:{'Content-Type':'text/html'}});await assert.rejects(request('login'),error=>error.status===503&&error.code==='INVALID_RESPONSE'&&!error.message.includes('private'));}finally{globalThis.fetch=original;}
});
test('JSON error codes retain status while malformed success is a distinct response failure',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>new Response(JSON.stringify({error:'Origin rejected'}),{status:403});await assert.rejects(request('login'),error=>error.status===403&&error.code==='Origin rejected');globalThis.fetch=async()=>new Response('<html>wrong host</html>',{status:200});await assert.rejects(request('session'),error=>error.status===200&&error.code==='INVALID_RESPONSE');}finally{globalThis.fetch=original;}
});
