import {commandFields} from '../src/domain/commands.js';
// Finite semantic resources. No caller-supplied route, SQL, account or HTTP method.
const spec=(service,collection,key,fields,options={})=>({service,collection,key,fields,...options});
export const contentResources=Object.freeze({
 shoots:spec('projects',null,'items',commandFields.shoot,{projectCollection:'contents',commandType:'shoot'}),
 tasks:spec('projects',null,'items',commandFields.task,{projectCollection:'tasks',commandType:'task'}),
 project_members:spec('projects',null,'items',commandFields.member,{projectCollection:'members',commandType:'member'}),
 project_equipment:spec('projects',null,'items',commandFields.equipment,{projectCollection:'gear',commandType:'equipment'}),
 project_references:spec('projects',null,'items',commandFields.reference,{projectCollection:'refs',commandType:'reference'}),

 document_blocks:spec('handleDocumentLibrary','/api/document-library',null,['type','content','checked','align','color','background','indent','url','caption','referenceId'],{blocks:'documents'}),
 project_blocks:spec('projects',null,null,['type','content','checked','align','color','background','indent','url','caption','referenceId'],{blocks:'project_documents',project:true}),
 note_blocks:spec('handleScripture','/api/scripture/notes',null,['type','content','checked','align','color','background','indent','url','caption','referenceId'],{blocks:'notes',detail:true}),
 shared_projects:spec('sharedProjects',null,'projects',[],{readOnly:true,detail:true}),
 organizations:spec('handleInventory','/api/inventory','organizations',[],{readOnly:true}),
 shoot_configuration:spec('projects',null,null,['memberIds','gearIds','rentals','cameras','layoutObjects'],{shoot:true}),
 documents:spec('handleDocumentLibrary','/api/document-library','documents',['title','blocks'],{document:true}),
 project_documents:spec('projects',null,'documents',['title','blocks'],{project:true,document:true}),
 notes:spec('handleScripture','/api/scripture/notes','notes',['document','kind','date','passage','speaker','sourceUrl','properties','categories','qtJournal','qtVerses'],{detail:true}),
 qt:spec('handleScripture','/api/scripture/notes','notes',['document','date','passage','sourceUrl','properties','qtJournal','qtVerses'],{detail:true,kind:'qt'}),
 gratitude:spec('handleScripture','/api/scripture/qt/entries','entries',['text','content'],{entry:'gratitude'}),
 prayers:spec('handleScripture','/api/scripture/qt/entries','entries',['text','content','target','recipient'],{entry:'prayers'}),
 annotations:spec('handleScripture','/api/scripture/annotations','annotations',['color','background','memo','ranges'],{annotation:true}),
 bible:spec('handleScripture','/api/scripture/bible',null,[],{readOnly:true}),
 references:spec('handleReferenceLibrary','/api/reference-library','references',['name','notes','url','tags','collection','images','files']),
 boards:spec('handleReferenceBoards','/api/reference-boards',null,['items'],{detail:true}),
 materials:spec('handleMaterials','/api/materials','items',['url','title','description','category','tags']),
 members:spec('handleContacts','/api/contacts','contacts',['name','role','phone','email','notes']),
 member_equipment:spec('handleContacts',null,'equipment',['name','category','quantity','code','serial','notes','catalogModelId'],{member:true}),
 inventory:spec('handleInventory','/api/inventory','items',['name','category','inventoryCode','serialNumber','model','trackingMode','quantity','storageLocation','condition','custodian','ownership','organizationId','catalogModelId']),
 loans:spec('handleInventory','/api/inventory/loans','loans',['borrower','team','destination','dueAt','note','lines'],{loan:true}),
 returns:spec('handleInventory','/api/inventory/loans','loans',['note','lines'],{returns:true}),
 catalog:spec('handleEquipmentCatalog','/api/equipment-catalog','models',['manufacturer','name','nickname','category','photo'],{catalog:true,detail:true}),
 vendors:spec('handleRentalVendors','/api/rental-vendors','vendors',['name','contact','phone','email','website','address','notes'])
});
export function resourceSpec(name){if(!Object.hasOwn(contentResources,name))throw Error('Unsupported content resource');return contentResources[name];}
export const contentResourceNames=Object.keys(contentResources);
export function resourceManifest({canManageCatalog}={}){return contentResourceNames.map(id=>({id,service:contentResources[id].service,fields:contentResources[id].fields,readOnly:!!contentResources[id].readOnly||(!!contentResources[id].catalog&&canManageCatalog===false),...(contentResources[id].catalog?{operations:['create','update'],shared:true,writeRequires:'existing-catalog-manager-permission',...(canManageCatalog!==undefined?{canWrite:canManageCatalog}:{}),photo:{types:['image/png','image/jpeg','image/webp'],input:'photo:{type,base64}; null removes photo; omission preserves existing photo; no remote URLs',maxValuesJsonBytes:65536}}:{}),requiresParent:contentResources[id].member?'memberId':(contentResources[id].project||contentResources[id].shoot||contentResources[id].projectCollection)?'projectId':undefined}));}
