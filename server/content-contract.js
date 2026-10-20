import {resourceManifest} from './content-resources.js';
import {commandOperations} from '../src/domain/commands.js';
// This registry classifies app services, not arbitrary URLs or database tables.
// New services must make an explicit consent/permission decision before MCP exposure.
export const contentContractVersion=2;
export const contentServices=Object.freeze({
 projects:{access:'enabled',scope:'studio:read',writeScope:'studio:write',operations:commandOperations},
 sharedProjects:{access:'consent-required',consentVersion:1,content:['shared-project-projection'],readOnly:true},
 handleScripture:{access:'consent-required',consentVersion:1,content:['notes','qt','gratitude','prayers','verse-annotations','bible']},
 handleDocumentLibrary:{access:'consent-required',consentVersion:1,content:['account-documents']},
 handleReferenceLibrary:{access:'consent-required',consentVersion:1,content:['references']},
 handleReferenceBoards:{access:'consent-required',consentVersion:1,content:['reference-boards']},
 handleMaterials:{access:'consent-required',consentVersion:1,content:['materials']},
 handleContacts:{access:'consent-required',consentVersion:1,content:['member-content','member-equipment']},
 handleRentalVendors:{access:'consent-required',consentVersion:1,content:['rental-vendors']},
 handleEquipmentCatalog:{access:'consent-required',consentVersion:1,content:['equipment-catalog']},
 handleInventory:{access:'consent-required',consentVersion:1,content:['personal-equipment','organization-equipment','checkout','returns','history']},
 handleEquipmentSharing:{access:'excluded',reason:'Sharing and permission administration remain in the app.'},
 handleSiteRoles:{access:'excluded',reason:'Account, settings and administrator actions remain in the app.'},
 handleAdminProjectFiles:{access:'excluded',reason:'Administrator area remains in the app.'},
 handleAdminProjects:{access:'excluded',reason:'Administrator area remains in the app.'},
 handleInvitations:{access:'excluded',reason:'Invitations and permission changes remain in the app.'},
 handleAccountDeletion:{access:'excluded',reason:'Account deletion remains in the app.'},
 handleAccounts:{access:'excluded',reason:'Account administration remains in the app.'},
 oauth:{access:'excluded',reason:'Connection consent and credentials remain in the app.'},
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
export function contentCapabilities(){return {version:contentContractVersion,resources:resourceManifest(),services:Object.entries(contentServices).map(([id,{access,content,operations}])=>({id,access,...(content?{content}:{}),...(operations?{operations:[...operations]}:{})}))};}
