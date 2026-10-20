import {contentResources,resourceManifest} from '../server/content-resources.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contentServices,contentCapabilities,requireContentAccess} from '../server/content-contract.js';
import {commandOperations} from '../src/domain/commands.js';
test('every app service requires an explicit content exposure decision',async()=>{
 const app=await readFile(new URL('../server/index.js',import.meta.url),'utf8');
 const services=[...app.matchAll(/if\(await (handle[A-Za-z]+)\(/g),...app.matchAll(/if\(await ([A-Za-z]+)\.routes\(/g)].map(match=>match[1]);
 assert.ok(services.length>=16);
 for(const service of services)assert.ok(Object.hasOwn(contentServices,service),'Classify new app service: '+service);
 for(const contract of Object.values(contentServices))assert.ok(['enabled','consent-required','excluded'].includes(contract.access));
 assert.deepEqual(contentCapabilities().services.find(item=>item.id==='projects').operations,commandOperations);
});
test('new and sensitive content stays inaccessible even to existing writable grants',()=>{
 const grants=[{}, {scope:'studio:read'},{scope:'studio:read studio:write'},{scope:'studio:read studio:write studio:all'}];
 for(const [id,contract] of Object.entries(contentServices))if(contract.access!=='enabled')for(const grant of grants)for(const write of [false,true])assert.throws(()=>requireContentAccess(id,grant,{write}));
 for(const id of ['new-service','__proto__','constructor','settings','admin','account'])assert.throws(()=>requireContentAccess(id,grants[2]));
 assert.throws(()=>requireContentAccess('projects',{}));assert.throws(()=>requireContentAccess('projects',grants[1],{write:true}));
 assert.ok(requireContentAccess('projects',grants[1]));assert.ok(requireContentAccess('projects',grants[2],{write:true}));
});
test('account, settings, permissions and administration are explicitly excluded',()=>{
 for(const id of ['account','oauth','googleSheets','handleAccounts','handleAccountDeletion','handleSiteRoles','handleAdminProjects','handleAdminProjectFiles','handleInvitations','handleEquipmentSharing'])assert.equal(contentServices[id].access,'excluded',id);
});

test('every supported resource declares a classified service, field contract and existing handlers',()=>{
 const manifest=resourceManifest();assert.equal(manifest.length,Object.keys(contentResources).length);
 for(const item of manifest){assert.ok(Object.hasOwn(contentServices,item.service),item.id);assert.notEqual(contentServices[item.service].access,'excluded',item.id);assert.ok(Array.isArray(item.fields));assert.ok(item.readOnly||item.fields.length>0,item.id);}
 for(const [id,service] of Object.entries(contentServices))if(service.access==='consent-required')assert.ok(manifest.some(resource=>resource.service===id),'Resource adapter missing: '+id);
});
test('trusted persisted consent enables content while scope and excluded service boundaries remain enforced',()=>{
 assert.ok(requireContentAccess('handleScripture',{scope:'studio:read'},{consentVersion:1}));
 assert.throws(()=>requireContentAccess('handleScripture',{scope:'studio:read'},{consentVersion:1,write:true}));
 assert.ok(requireContentAccess('handleDocumentLibrary',{scope:'studio:read studio:write'},{consentVersion:1,write:true}));
 assert.throws(()=>requireContentAccess('handleAccounts',{scope:'studio:read studio:write'},{consentVersion:1,write:true}));
});
test('future editable fields cannot silently add credential, account or permission controls',()=>{
 const forbidden=new Set(['accountId','userId','ownerId','scope','password','permissions','roleId','inviterId','operators','account','settings','admin','token','grantId']);
 for(const resource of resourceManifest())for(const field of resource.fields)assert.equal(forbidden.has(field),false,'Explicit security review required for '+resource.id+'.'+field);
});
test('service requirement and actual connection approval are explicitly separate',()=>{
 const pending=contentCapabilities({scope:'studio:read studio:write'}),approved=contentCapabilities({scope:'studio:read studio:write',consentVersion:1}),reader=contentCapabilities({scope:'studio:read',consentVersion:1});
 assert.equal(pending.connection.requiresOwnerConsent,true);assert.equal(approved.connection.requiresOwnerConsent,false);assert.equal(approved.connection.canWriteFullContent,true);assert.equal(reader.connection.canWriteFullContent,false);
 for(const capabilities of [pending,approved,reader])assert.equal(capabilities.services.find(item=>item.id==='handleInventory').access,'consent-required');
 assert.equal(approved.services.find(item=>item.id==='handleInventory').effectiveAccess,'read-write');assert.equal(reader.services.find(item=>item.id==='handleInventory').effectiveAccess,'read-only');assert.equal(approved.services.find(item=>item.id==='handleEquipmentCatalog').effectiveAccess,'read-only');assert.equal(approved.services.find(item=>item.id==='handleAccounts').effectiveAccess,'excluded');
});
