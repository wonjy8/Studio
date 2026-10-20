import {commandOperations} from '../src/domain/commands.js';
// This registry classifies app services, not arbitrary URLs or database tables.
// New services must make an explicit consent/permission decision before MCP exposure.
export const contentContractVersion=1;
export const contentServices=Object.freeze({
 projects:{access:'enabled',scope:'studio:read',writeScope:'studio:write',operations:commandOperations},
 handleScripture:{access:'pending-consent',content:['notes','qt','gratitude','prayers','verse-annotations','bible']},
 handleDocumentLibrary:{access:'pending-consent',content:['account-documents']},
 handleReferenceLibrary:{access:'pending-consent',content:['references']},
 handleReferenceBoards:{access:'pending-consent',content:['reference-boards']},
 handleMaterials:{access:'pending-consent',content:['materials']},
 handleContacts:{access:'pending-consent',content:['member-content','member-equipment']},
 handleRentalVendors:{access:'pending-consent',content:['rental-vendors']},
 handleEquipmentCatalog:{access:'pending-consent',content:['equipment-catalog']},
 handleInventory:{access:'pending-consent',content:['personal-equipment','organization-equipment','checkout','returns','history']},
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
export function requireContentAccess(service,grant,{write=false}={}){
 const contract=Object.hasOwn(contentServices,service)?contentServices[service]:null;
 if(!contract||contract.access!=='enabled')throw Error('Content service is unavailable through MCP. Use Studio directly.');
 const scopes=typeof grant?.scope==='string'?grant.scope.split(' '):[];
 if(!scopes.includes(contract.scope)||(write&&!scopes.includes(contract.writeScope)))throw Error('Content consent is required.');
 return contract;
}
export function contentCapabilities(){return {version:contentContractVersion,services:Object.entries(contentServices).map(([id,{access,content,operations}])=>({id,access,...(content?{content}:{}),...(operations?{operations:[...operations]}:{})}))};}
