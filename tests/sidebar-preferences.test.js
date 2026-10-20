import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSidebarPreferences,orderSidebarItems,mergeSidebarOrder} from '../src/domain/sidebar-preferences.js';
test('sidebar preferences discard invalid input, keep stable IDs and retain new visible entries',()=>{
 const prefs=normalizeSidebarPreferences({collapsed:true,orders:{rail:['settings','settings',null,'workspace-home'],unknown:['x'],scripture:'bad',projects:['project:b','project:b',null,'project:a']}});
 assert.deepEqual(prefs,{version:1,collapsed:true,orders:{projects:['project:b','project:a']}});
 assert.equal(prefs.orders.rail,undefined);assert.deepEqual(orderSidebarItems(['project:a','project:b','project:c'],prefs.orders.projects),['project:b','project:a','project:c']);
 assert.deepEqual(normalizeSidebarPreferences(null),{version:1,collapsed:false,orders:{}});
});
test('reordering visible entries preserves temporarily hidden permission-dependent entries',()=>{
 const saved=['home','admin','settings'];const next=mergeSidebarOrder(saved,['settings','home']);
 assert.deepEqual(next,['settings','admin','home']);assert.deepEqual(orderSidebarItems(['home','admin','settings'],next),['settings','admin','home']);
 assert.deepEqual(mergeSidebarOrder([],['a','b','a']),['a','b']);
});
