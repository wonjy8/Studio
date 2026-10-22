import {resourceManifest} from './content-resources.js';
import {commandOperations} from '../src/domain/commands.js';
// This registry classifies app services, not arbitrary URLs or database tables.
// New services must make an explicit consent/permission decision before MCP exposure.
export const contentContractVersion=7;
export const contentServices=Object.freeze({
 handleDocumentFiles:{access:'excluded',reason:'Private document image bytes and upload contexts are not MCP content resources'},
 handleWorkspaceHomeEvents:{access:'consent-required',consentVersion:1,consentScope:'workspace-content-v1',content:['own-home-events']},
 handleSchool:{access:'consent-required',consentVersion:1,consentScope:'school-content-v1',content:['school-semesters','school-courses','school-syllabus','lecture-notes','course-modules','school-tasks','school-events','credit-requirements']},
 projects:{access:'enabled',scope:'studio:read',writeScope:'studio:write',operations:commandOperations},
 sharedProjects:{access:'consent-required',consentVersion:1,content:['shared-project-projection'],readOnly:true},
 handleScripture:{access:'consent-required',consentVersion:1,content:['notes','qt','gratitude','prayers','verse-annotations','bible']},
 handleDocumentLibrary:{access:'consent-required',consentVersion:1,content:['account-documents']},
 handleReferenceLibrary:{access:'consent-required',consentVersion:1,content:['references']},
 handleReferenceBoards:{access:'consent-required',consentVersion:1,content:['reference-boards']},
 handleMaterials:{access:'consent-required',consentVersion:1,content:['materials']},
 handleContacts:{access:'consent-required',consentVersion:1,content:['member-content','member-equipment']},
 handleRentalVendors:{access:'consent-required',consentVersion:1,content:['rental-vendors']},
 handleEquipmentCatalog:{access:'consent-required',writeRequires:'existing-catalog-manager-permission',consentVersion:1,content:['equipment-catalog']},
 handleInventory:{access:'consent-required',consentVersion:1,content:['personal-equipment','organization-equipment','checkout','returns','history']},
 handleEquipmentSharing:{access:'excluded',reason:'Sharing and permission administration remain in the app.'},
 handleSiteRoles:{access:'excluded',reason:'Account, settings and administrator actions remain in the app.'},
 handleAdminProjectFiles:{access:'excluded',reason:'Administrator area remains in the app.'},
 handleAdminProjects:{access:'excluded',reason:'Administrator area remains in the app.'},
 handleInvitations:{access:'excluded',reason:'Invitations and permission changes remain in the app.'},
 handleAccountDeletion:{access:'excluded',reason:'Account deletion remains in the app.'},
 handleAccounts:{access:'excluded',reason:'Account administration remains in the app.'},
 oauth:{access:'excluded',reason:'Connection consent and credentials remain in the app.'},
 googleRead:{access:'excluded',reason:'Private Docs/Forms OAuth settings, credentials and external file verification are excluded.'},
 googleUnified:{access:'excluded',reason:'Private Google connection settings and OAuth credentials are excluded.'},tasksGoogle:{access:'excluded',reason:'Tasks OAuth/settings and unlinked private Google tasks are excluded from MCP; only explicitly linked Studio completion is synchronized.'},
 calendar:{access:'excluded',reason:'Calendar OAuth/settings and imported private events stay in the connected user home, not shared project/MCP content.'},
 googleSheets:{access:'excluded',reason:'Integration settings and synchronization remain in the app.'},
 account:{access:'excluded',reason:'Login, profile, password, account deletion and settings remain in the app.'}
});
export function requireContentAccess(service,grant,{write=false,consentVersion=0}={}){
 const contract=Object.hasOwn(contentServices,service)?contentServices[service]:null;
 if(!contract||contract.access==='excluded'||(contract.access==='consent-required'&&consentVersion!==contract.consentVersion))throw Error('Content service is unavailable through MCP. Use Studio directly.');
 const scopes=typeof grant?.scope==='string'?grant.scope.split(' '):[];
 if(!scopes.includes(contract.scope||'studio:read')||(write&&!scopes.includes(contract.writeScope||'studio:write')))throw Error('Content consent is required.');
 return contract;
}
export function contentCapabilities({scope='',consentVersion=0,schoolConsentVersion=0,workspaceConsentVersion=0,canManageCatalog=false}={}){
 const scopes=scope.split(' '),read=scopes.includes('studio:read'),write=scopes.includes('studio:write'),workspaceApproved=workspaceConsentVersion===1,approved=consentVersion===1||workspaceApproved,schoolApproved=schoolConsentVersion===1||workspaceApproved;
 return {version:contentContractVersion,accessMeaning:'services.access describes a fixed requirement, not this connection approval status',connection:{workspaceConsentVersion,currentAndFutureWorkspacesApproved:workspaceApproved,schoolConsentVersion,schoolContentApproved:schoolApproved,canReadSchool:schoolApproved&&read,canWriteSchool:schoolApproved&&read&&write,fullContentConsentVersion:consentVersion,fullContentApproved:approved,requiresOwnerConsent:!approved,canReadFullContent:approved&&read,canWriteFullContent:approved&&read&&write},resources:resourceManifest({canManageCatalog:canManageCatalog&&approved&&read&&write}),services:Object.entries(contentServices).map(([id,{access,content,operations,readOnly}])=>({id,access,effectiveAccess:access==='excluded'?'excluded':!read?'unavailable':access==='consent-required'&&!(id==='handleSchool'?schoolApproved:id==='handleWorkspaceHomeEvents'?workspaceApproved:approved)?'consent-required':write&&!readOnly&&(id!=='handleEquipmentCatalog'||canManageCatalog)?'read-write':'read-only',...(content?{content}:{}),...(operations?{operations:[...operations]}:{})}))};
}
