import {workspaceHomeEventRoutes} from './workspace-home-events.js';
import {schoolRoutes} from './school.js';
import {schoolSelected,schoolMutation} from './school-content.js';
import {configureSiteRoleManagement} from './site-roles.js';
import {isAdmin} from './invitations.js';
import {applyCommands} from '../src/domain/commands.js';
import {requireContentAccess} from './content-contract.js';
import {sharedProjectProjection} from './accounts.js';
import {validateWorkspace} from '../src/domain/workspace.js';
import {shootConfiguration} from '../src/domain/shoots.js';
import {accountActive,passwordChangeRequired} from './accounts.js';
import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {scriptureRoutes} from './scripture.js';
import {documentLibraryRoutes} from './document-library.js';
import {referenceLibraryRoutes} from './reference-library.js';
import {referenceBoardRoutes} from './reference-boards.js';
import {rentalVendorRoutes} from './rental-vendors.js';
import {contactRoutes} from './contacts.js';
import {equipmentCatalogRoutes} from './equipment-catalog.js';
import {inventoryRoutes,orgCanRead} from './inventory.js';
import {equipmentProjectScope} from './equipment-sharing.js';
import {materialLibraryRoutes} from './material-library.js';
import {readWorkspace,writeWorkspace} from './workspace-service.js';
import {newDocument,newBlock,validDocuments} from '../src/domain/documents.js';
import {newScriptureNote} from '../src/domain/scripture.js';
import {journalForQt} from '../src/domain/qt-journal.js';
import {contentRegistry,resourceManifest} from './content-resources.js';
const registry=contentRegistry(workerData.workspaces||[]),resourceSpec=name=>registry.spec(name);
const connection=new DatabaseSync(workerData.file);connection.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000');
// Route services already own their nested transactions. Savepoints compose those
// transactions inside the preview/apply transaction on this dedicated connection.
let nested=0;
const db={prepare:sql=>connection.prepare(sql),exec:sql=>{
 if(/^BEGIN(?: IMMEDIATE)?$/i.test(sql)){connection.exec('SAVEPOINT content_nested_'+(++nested));return;}
 if(/^COMMIT$/i.test(sql)){connection.exec('RELEASE content_nested_'+nested--);return;}
 if(/^ROLLBACK$/i.test(sql)){connection.exec('ROLLBACK TO content_nested_'+nested+'; RELEASE content_nested_'+nested--);return;}
 connection.exec(sql);
}};
configureSiteRoleManagement(db,workerData.siteRoleManagementEnabled);
const options={initialize:false};
const handlers={handleWorkspaceHomeEvents:workspaceHomeEventRoutes(db,{contentWorker:true}),handleSchool:schoolRoutes(db),handleScripture:scriptureRoutes(db,{...options,githubToken:''}),handleDocumentLibrary:documentLibraryRoutes(db,options),handleReferenceLibrary:referenceLibraryRoutes(db,options),handleReferenceBoards:referenceBoardRoutes(db,options),handleRentalVendors:rentalVendorRoutes(db,options),handleContacts:contactRoutes(db,{...options,orgCanRead,equipmentProjectScope}),handleEquipmentCatalog:equipmentCatalogRoutes(db,options),handleInventory:inventoryRoutes(db,options),handleMaterials:materialLibraryRoutes(db,{...options,preview:false})};
const canonicalResource=args=>resourceSpec(args.resource).canonicalResource||args.resource;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identity=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw Error('Read a valid content ID first');return value;};
function consent(grantId,uid,write=false,school=false){
 if(!accountActive(db,uid)||passwordChangeRequired(db,uid))throw Error('Account unavailable');
 const workspace=db.prepare("SELECT g.scope,c.generation FROM oauth_grants g JOIN integration_workspace_consents c ON c.grant_id=g.id AND c.user_id=g.user_id WHERE g.id=? AND g.user_id=? AND g.revoked=0 AND g.refresh_expires>? AND g.access_expires>? AND NOT EXISTS(SELECT 1 FROM oauth_manual_clients m WHERE m.client_id=g.client_id AND m.revoked=1) AND c.version=1 AND c.scope='workspace-content-v1'").get(grantId,uid,Date.now(),Date.now());
 const row=workspace||db.prepare('SELECT g.scope'+(school?',c.generation':'')+' FROM oauth_grants g JOIN '+(school?'integration_school_consents':'integration_content_consents')+' c ON c.grant_id=g.id AND c.user_id=g.user_id WHERE g.id=? AND g.user_id=? AND g.revoked=0 AND g.refresh_expires>? AND g.access_expires>? AND NOT EXISTS(SELECT 1 FROM oauth_manual_clients m WHERE m.client_id=g.client_id AND m.revoked=1) AND c.version=1'+(school?" AND c.scope='school-content-v1'":'')).get(grantId,uid,Date.now(),Date.now());
 if(!row||!row.scope.split(' ').includes('studio:read')||(write&&!row.scope.split(' ').includes('studio:write')))throw Error((school?'School':'Full content')+' consent is required in Studio connections settings');
 return {...row,workspaceApproved:!!workspace};
}
async function invoke(service,uid,path,method='GET',body){
 const url=new URL(path,'http://studio.internal');let value,status;
 const handled=await handlers[service]({path:url.pathname,url,req:{method,headers:{}},session:{user_id:uid},json:(code,data)=>{status=code;value=data;},readJson:async limit=>{if(Buffer.byteLength(JSON.stringify(body))>limit)throw Error('Content too large');return structuredClone(body);},assertLiveMutation:()=>{}});
 if(!handled||!status)throw Error('Unsupported content action');if(status>=400)throw Object.assign(Error(value?.error||'Content rejected'),{status});return value;
}
function base(spec,args){return spec.member?'/api/contacts/'+identity(args.memberId)+'/equipment':spec.collection;}
async function snapshot(uid,args){
 const spec=resourceSpec(args.resource),id=args.id;if(spec.school)return invoke('handleSchool',uid,'/api/school');
 if(spec.projectCollection){const current=readWorkspace(db,uid),project=[current.state,...current.state.projects||[]].find(p=>p.project.id===args.projectId);if(!project)throw Error('Project not found');return {items:project[spec.projectCollection]||[],revision:current.revision};}
 if(spec.blocks){if(!id)throw Error('Parent document/note id is required');return snapshot(uid,{...args,resource:spec.blocks});}
 if(canonicalResource(args)==='shared_projects'){
  if(id){identity(id);identity(args.ownerId);if(!db.prepare('SELECT user_id FROM project_accounts WHERE owner_id=? AND project_id=? AND user_id=?').get(args.ownerId,id,uid))throw Error('Shared project not found');const p=[readWorkspace(db,args.ownerId).state,...readWorkspace(db,args.ownerId).state.projects||[]].find(p=>p.project.id===id);if(!p)throw Error('Shared project not found');return {project:sharedProjectProjection(p),readOnly:true};}
  return {projects:db.prepare('SELECT owner_id,project_id FROM project_accounts WHERE user_id=? AND owner_id<>?').all(uid,uid).flatMap(link=>{const state=readWorkspace(db,link.owner_id).state,p=[state,...state.projects||[]].find(p=>p.project.id===link.project_id);return p?[{id:link.project_id,ownerId:link.owner_id,name:p.project.name,readOnly:true}]:[];})};
 }
 if(spec.shoot){const current=readWorkspace(db,uid),project=[current.state,...current.state.projects||[]].find(p=>p.project.id===args.projectId),shoot=project?.contents.find(item=>item.id===id);if(!shoot)throw Error('Shoot not found');return {configuration:shootConfiguration(project,shoot),revision:current.revision};}

 if(spec.detail&&!id&&canonicalResource(args)==='catalog')return invoke(spec.service,uid,spec.collection+'?'+new URLSearchParams({q:args.query||'',offset:String(args.offset||0),limit:String(args.limit||25)}));
 if(spec.project){const current=readWorkspace(db,uid),project=[current.state,...current.state.projects||[]].find(p=>p.project.id===args.projectId);if(!project)throw Error('Project not found');return {documents:project.documents||[],revision:current.revision};}
 if(spec.annotation){if(!args.book||!Number.isSafeInteger(args.chapter)||args.chapter<1)throw Error('Book and chapter are required');return invoke(spec.service,uid,spec.collection+'?'+new URLSearchParams({book:args.book,chapter:String(args.chapter)}));}
 if(spec.entry&&args.noteId){const {note}=await invoke(spec.service,uid,'/api/scripture/notes/'+identity(args.noteId));return {revision:note.revision,entries:(note.qtJournal?.[spec.entry]||[]).map(item=>({...item,noteId:args.noteId}))};}
 if(spec.entry)return invoke(spec.service,uid,spec.collection+'?'+new URLSearchParams({kind:spec.entry,limit:String(args.limit||25),offset:String(args.offset||0),q:args.query||''}));
 if(spec.detail&&id)return invoke(spec.service,uid,base(spec,args)+'/'+identity(id));
 if(spec.detail&&canonicalResource(args)==='boards')throw Error('Read a reference ID first');
 if(canonicalResource(args)==='bible'){const params=new URLSearchParams();for(const field of ['book','chapter','passage','version'])if(args[field]!==undefined)params.set(field,String(args[field]));const {repository,...stored}=await invoke(spec.service,uid,spec.collection+'?'+params);return stored;}
 const value=await invoke(spec.service,uid,base(spec,args)+(spec.loan||spec.returns?'?status=all':''));
 if(canonicalResource(args)==='members')value.contacts=value.contacts.map(({accountId,account,canLinkAccount,...item})=>item);
 return value;
}
function beforeDocument(spec,value,args){if(spec.blocks==='notes')return value.note.document;const doc=value.documents?.find(item=>item.id===args.id);if(!doc)throw Error('Document not found');return doc;}
function selected(spec,value,args){
 if(spec.school)return schoolSelected(value.school,args);
 if(spec.blocks){const document=beforeDocument(spec,value,args);if(args.blockId){const block=document.blocks.find(item=>item.id===args.blockId);if(!block)throw Error('Block not found');return block;}return document.blocks;}
 if(spec.detail&&args.id){if(spec.kind&&value.note?.kind!==spec.kind)throw Error('Note not found');return value.note||value.model||value.project||value;}
 if(spec.shoot)return value.configuration;
 if(!spec.key)return value;
 let items=value[spec.key]||[];if(canonicalResource(args)==='organizations')items=items.map(({id,name})=>({id,name}));if(spec.kind)items=items.filter(item=>item.kind===spec.kind);
 if(args.id){const item=items.find(item=>item.id===args.id);if(!item)throw Error('Content not found');return item;}
 return items;
}
function cleanFields(spec,value){return Object.fromEntries(Object.entries(value).filter(([key])=>spec.fields.includes(key)));}
async function mutate(uid,args,values,before,requestId){
 const spec=resourceSpec(args.resource);if(spec.readOnly)throw Error('Read-only content; use Studio for read-only content');
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(key=>!spec.fields.includes(key)))throw Error('Unsupported content fields');
 if(spec.school){const next=structuredClone(before.school),result=schoolMutation(db,next,args,values,uid),saved=await invoke('handleSchool',uid,'/api/school','PUT',{school:next,revision:before.revision});return {...result,revision:saved.revision};}
 const id=args.id,old=id?selected(spec,before,args):null;
 if(canonicalResource(args)==='home_events'){const payload={...cleanFields(spec,old||{}),...values};return invoke(spec.service,uid,spec.collection+(id?'/'+identity(id):''),id?'PATCH':'POST',id?{revision:old.revision,values:payload}:{id:randomUUID(),values:payload});}
 if(spec.commandType){const current=readWorkspace(db,uid),change=applyCommands(current.state,args.projectId,[{operation:(id?'update_':'add_')+spec.commandType,...(id?{entityId:id}:{}),values}]);if(!validateWorkspace(change.state))throw Error('Invalid project content');const saved=writeWorkspace(db,uid,change.state,current.revision),project=[change.state,...change.state.projects||[]].find(p=>p.project.id===args.projectId),item=id?project[spec.projectCollection].find(item=>item.id===id):project[spec.projectCollection].find(item=>!before.items.some(prior=>prior.id===item.id));return {revision:saved.revision,item};}

 if(spec.blocks){
  const document=beforeDocument(spec,before,args),blocks=document.blocks;
  if(args.blockId&&!blocks.some(item=>item.id===args.blockId))throw Error('Block not found');
  const block={...(args.blockId?blocks.find(item=>item.id===args.blockId):newBlock(values.type||'paragraph')),...values};if(block.type!=='todo')delete block.checked;if(block.type!=='image')delete block.url;if(block.type!=='reference')delete block.referenceId;
  const next={...document,blocks:args.blockId?blocks.map(item=>item.id===args.blockId?block:item):[...blocks,block]};if(!validDocuments([next]))throw Error('Invalid block');
  if(spec.blocks==='notes'){const {revision,createdAt,updatedAt,externalId,automaticQt,...note}=before.note;return invoke(spec.service,uid,'/api/scripture/notes/'+identity(id),'PUT',{revision,note:{...note,document:next}});}
  const documents=before.documents.map(item=>item.id===id?next:item);
  if(spec.project){const current=readWorkspace(db,uid),project=[current.state,...current.state.projects||[]].find(p=>p.project.id===args.projectId);project.documents=documents;return {...writeWorkspace(db,uid,current.state,current.revision),block};}
  await invoke(spec.service,uid,'/api/document-library','PUT',{documents,revision:before.revision});return {block};
 }

 if(spec.shoot){const current=readWorkspace(db,uid),project=[current.state,...current.state.projects||[]].find(p=>p.project.id===args.projectId),shoot=project?.contents.find(item=>item.id===id);if(!shoot)throw Error('Shoot not found');shoot.configuration={...before.configuration,...values};if(!validateWorkspace(current.state))throw Error('Invalid shoot content or references');return {...writeWorkspace(db,uid,current.state,current.revision),configuration:shoot.configuration};}

 if(spec.document){
  const docs=before.documents,prior=id&&docs.find(doc=>doc.id===id);if(id&&!prior)throw Error('Document not found');const doc={...(prior||newDocument()),...values};const next=prior?docs.map(item=>item.id===id?doc:item):[...docs,doc];if(!validDocuments(next))throw Error('Invalid document');
  if(spec.project){const current=readWorkspace(db,uid),project=[current.state,...current.state.projects||[]].find(p=>p.project.id===args.projectId);project.documents=next;return {...writeWorkspace(db,uid,current.state,before.revision),document:doc};}
  await invoke(spec.service,uid,spec.collection,'PUT',{documents:next,revision:before.revision});return {document:doc};
 }
 if(spec.entry){
  if(!args.noteId)throw Error('Choose a QT note ID');const result=await invoke(spec.service,uid,'/api/scripture/notes/'+identity(args.noteId)),note=result.note;
  if(note.kind!=='qt')throw Error('Choose a QT note');note.qtJournal=journalForQt(note);const items=note.qtJournal[spec.entry]||[];
  if(id&&!items.some(item=>item.id===id))throw Error('Entry not found in this QT');
  const item={...(id?items.find(item=>item.id===id):{id:'entry-'+randomUUID(),text:'',...(spec.returns?{}:spec.entry==='prayers'?{target:'self',recipient:''}:{})}),...values};
  if(Object.hasOwn(values,'text')&&!Object.hasOwn(values,'content'))delete item.content;
  note.qtJournal[spec.entry]=id?items.map(entry=>entry.id===id?item:entry):[...items,item];
  const {revision,createdAt,updatedAt,externalId,automaticQt,...body}=note;
  return invoke(spec.service,uid,'/api/scripture/notes/'+identity(args.noteId),'PUT',{revision,note:body});
 }
 if(spec.annotation){const stored=(before.annotations||[]).find(item=>item.verse===args.verse),{revision=0,...prior}=stored||{};return invoke(spec.service,uid,spec.collection,'PUT',{revision,annotation:{color:'',background:'',memo:'',...prior,...values,book:args.book,chapter:args.chapter,verse:args.verse}});}
 if(canonicalResource(args)==='notes'||canonicalResource(args)==='qt'){
  const prior=id?before.note:null;if(id&&(!prior||(spec.kind&&prior.kind!==spec.kind)))throw Error('Note not found');const {revision,createdAt,updatedAt,externalId,automaticQt,...body}=prior||{};
  const baseNote=prior?body:newScriptureNote(spec.kind||values.kind||'sermon',values.date),note={...baseNote,...values};if(values.document)note.document={...baseNote.document,...values.document};if(values.qtJournal){note.qtJournal={...journalForQt(baseNote),...values.qtJournal};for(const field of ['word','application'])if(Object.hasOwn(values.qtJournal,field)&&!Object.hasOwn(values.qtJournal,field+'Content'))delete note.qtJournal[field+'Content'];}
  return invoke(spec.service,uid,spec.collection+(id?'/'+identity(id):''),id?'PUT':'POST',id?{revision,note}:note);
 }
 if(spec.returns){if(!id)throw Error('Read a loan ID first');return invoke(spec.service,uid,spec.collection+'/'+identity(id)+'/returns','POST',{...values,requestId});}
 if(spec.loan){if(id)throw Error('Issued loans are immutable; record a return');return invoke(spec.service,uid,spec.collection,'POST',{...values,requestId});}
 let current=old;
 if(canonicalResource(args)==='members'&&id){const row=db.prepare('SELECT body FROM contacts WHERE id=? AND user_id=?').get(id,uid);if(!row)throw Error('Member not found');current={...JSON.parse(row.body),revision:old.revision};}
 if(canonicalResource(args)==='inventory'&&id&&['ownership','organizationId'].some(key=>Object.hasOwn(values,key)&&values[key]!==current[key]))throw Error('Inventory custody changes must be performed in Studio');
 if(canonicalResource(args)==='materials'&&id&&Object.hasOwn(values,'url')&&values.url!==current.url)throw Error('Existing material URLs are immutable. Add a new link instead.');
 const payload={...cleanFields(spec,current||{}),...values,...(id&&current?.revision!==undefined?{revision:current.revision}:{})};
 if(canonicalResource(args)==='boards'){
  payload.updatedAt=current?.updatedAt??null;
  if(values.items&&!values.layout&&payload.layout){payload.layout=structuredClone(payload.layout);const known=new Set((current?.items||[]).map(item=>item.key));for(const item of values.items){if(known.has(item.key))continue;const moduleId='module-'+randomUUID();payload.layout.modules.push({id:moduleId,title:item.title||'',width:100,items:[item.key]});payload.layout.flow.push({type:'module',id:moduleId});}}
 }
 if(canonicalResource(args)==='members'&&current?.accountId)payload.accountId=current.accountId; // preserve, never accept account linkage from MCP
 const collection=canonicalResource(args)==='inventory'?'/api/inventory/items':base(spec,args);
 return invoke(spec.service,uid,collection+(id?'/'+identity(id):''),id?'PUT':'POST',payload);
}
function mutationResult(result){
 const {state,...value}=result;
 if(value.note){const n=value.note;value.note={document:{id:n.document.id,title:n.document.title,blockCount:n.document.blocks.length},kind:n.kind,date:n.date,revision:n.revision};}
 if(value.document)value.document={id:value.document.id,title:value.document.title,blockCount:value.document.blocks.length};
 if(Buffer.byteLength(JSON.stringify(value))>100000)return {summary:'Applied content is large; reread its fields with pagination.',id:value.id,revision:value.revision};
 return value;
}
async function run(message){
 const {kind,uid,grantId,args={},values,baseline,proposalId}=message;
 connection.exec('BEGIN IMMEDIATE');nested=0;
 try{
  const spec=resourceSpec(args.resource),grant=consent(grantId,uid,kind!=='read',!!spec.school);if(spec.workspaceConsentOnly&&!grant.workspaceApproved)throw Error('Current and future workspace consent is required');requireContentAccess(spec.service,grant,{write:kind!=='read',consentVersion:1});
  const before=await snapshot(uid,args),stamp=hash(spec.school||grant.workspaceApproved?{before,consentGeneration:grant.generation}:before);
  if(kind==='read'){
   let value=selected(spec,before,args);
   if(!args.id&&canonicalResource(args)==='shoots')value=value.map(({configuration,...shoot})=>({...shoot,hasConfiguration:!!configuration}));
   if(args.field){
    if(Array.isArray(value))throw Error('Read a detail ID before selecting a field');
    if((!args.id&&!spec.school)||!spec.fields.includes(args.field.split('.')[0])||args.field.split('.').length>2|| (args.field.includes('.')&&!['qtJournal.word','qtJournal.application','qtJournal.gratitude','qtJournal.prayers','qtJournal.memos','document.blocks'].includes(args.field)))throw Error('Read an allowed content field');
    value=args.field.split('.').reduce((item,key)=>item?.[key],value);
   }else if(spec.document||canonicalResource(args)==='school_notes'){const summarize=doc=>({id:doc.id,title:doc.title,blockCount:doc.blocks.length,...(spec.school?{archived:doc.archived,...(doc.modifiedAt?{modifiedAt:doc.modifiedAt}:{})}:{})});value=Array.isArray(value)?value.map(summarize):summarize(value);}
   else if(args.id&&['notes','qt'].includes(canonicalResource(args))){const {document,qtJournal,qtVerses,...metadata}=value;value={...metadata,document:{id:document.id,title:document.title,blockCount:document.blocks.length},...(qtJournal?{journalFields:['word','application','gratitude','prayers','memos']}:{}),verseCount:qtVerses?.length||0};}
   if(spec.entry&&!args.noteId&&!args.id)value={items:before.entries,nextOffset:before.nextOffset};else if(canonicalResource(args)==='catalog'&&!args.id)value={items:before.models,total:before.total,nextOffset:(args.offset||0)+(args.limit||25)<before.total?(args.offset||0)+(args.limit||25):null};else if((!args.id||args.field||spec.blocks&&!args.blockId||canonicalResource(args)==='school_note_blocks'&&!args.blockId)&&Array.isArray(value)){if(args.query)value=value.filter(item=>JSON.stringify(item).toLocaleLowerCase().includes(String(args.query).toLocaleLowerCase()));const offset=args.offset||0,limit=args.limit||25;const total=value.length;let count=limit;while(count>1&&Buffer.byteLength(JSON.stringify(value.slice(offset,offset+count)))>100000)count=Math.max(1,Math.floor(count/2));value={items:value.slice(offset,offset+count),total,nextOffset:offset+count<total?offset+count:null};}
   if(Buffer.byteLength(JSON.stringify(value))>131072)throw Error('Content response too large. Read a specific field or block with a smaller limit.');
   connection.exec('ROLLBACK');return {value,revision:stamp,manifest:resourceManifest({registry,canManageCatalog:isAdmin(db,uid)&&grant.scope.split(' ').includes('studio:write')})};
  }
  if(baseline&&baseline!==stamp)throw Object.assign(Error('Content changed. Read, propose and confirm again.'),{status:409});
  if(kind==='apply'){
   const pending=db.prepare('SELECT * FROM integration_content_proposals WHERE id=? AND user_id=? AND grant_id=? AND expires>?').get(proposalId,uid,grantId,Date.now());if(!pending)throw Error('Proposal unavailable or expired');
  }
  const result=await mutate(uid,args,values,before,proposalId||randomUUID());
  if(kind==='preview'){connection.exec('ROLLBACK');return {revision:stamp,preview:mutationResult(result)};}
  db.prepare('DELETE FROM integration_content_proposals WHERE id=? AND user_id=? AND grant_id=?').run(proposalId,uid,grantId);connection.exec('COMMIT');return {applied:true,result:mutationResult(result)};
 }catch(error){connection.exec('ROLLBACK');nested=0;throw error;}
}
let queue=Promise.resolve();parentPort.on('message',message=>{queue=queue.then(async()=>{try{parentPort.postMessage({request:message.request,value:await run(message)});}catch(error){parentPort.postMessage({request:message.request,error:error.message,status:error.status});}});});
