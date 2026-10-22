// Trusted startup registration only: clients select semantic IDs, never routes,
// SQL, services, roles or handler functions. New workspace contracts reuse vetted
// content adapters; new adapter implementations belong in reviewed server code.
const forbidden=/(^|_)(settings|admin|administrator|accounts?|credentials?|permissions?|oauth|secrets?)(_|$)/;
const id=value=>typeof value==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(value)&&!forbidden.test(value);
const extensionAdapters=new Set(['documents','references','materials','vendors']);
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export function createContentRegistry(definitions,workspaces=[]){
 const resources=structuredClone(definitions),workspaceIds=new Set();
 if(!Array.isArray(workspaces)||workspaces.length>50)throw Error('Invalid content workspaces');
 for(const workspace of workspaces){if(!workspace||Object.keys(workspace).some(k=>!['id','name','resources'].includes(k))||!id(workspace.id)||workspaceIds.has(workspace.id)||typeof workspace.name!=='string'||!workspace.name.trim()||workspace.name.length>100||!Array.isArray(workspace.resources)||!workspace.resources.length||workspace.resources.length>50)throw Error('Invalid content workspace');workspaceIds.add(workspace.id);
  for(const entry of workspace.resources){if(!entry||Object.keys(entry).some(k=>!['id','adapter'].includes(k))||!id(entry.id)||Object.hasOwn(resources,entry.id)||!extensionAdapters.has(entry.adapter)||!Object.hasOwn(definitions,entry.adapter))throw Error('Unsupported workspace content adapter');const adapter=definitions[entry.adapter];resources[entry.id]={...structuredClone(adapter),workspaceId:workspace.id,workspaceName:workspace.name,workspaceConsentOnly:true,canonicalResource:entry.adapter};}
 }
 freeze(resources);return Object.freeze({resources,names:Object.freeze(Object.keys(resources)),spec(name){if(!Object.hasOwn(resources,name))throw Error('Unsupported content resource');return resources[name];}});
}
