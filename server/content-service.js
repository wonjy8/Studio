import {siteRoleManagementEnabled} from './site-roles.js';
import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {resourceSpec,resourceManifest} from './content-resources.js';
export const fullContentConsentVersion=1;
export function setupContentConsent(db){db.exec(`CREATE TABLE IF NOT EXISTS integration_content_consents(grant_id TEXT PRIMARY KEY REFERENCES oauth_grants(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),version INTEGER NOT NULL,approved_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS integration_content_proposals(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,expires INTEGER NOT NULL);`);}
export function contentService(db){
 setupContentConsent(db);let worker;const pending=new Map();
 const close=()=>{for(const entry of pending.values())entry.reject(Error('Content service closed'));pending.clear();if(worker)worker.terminate();worker=null;};
 async function execute(grant,kind,args,extra={}){
  if(!db.prepare('SELECT grant_id FROM integration_content_consents WHERE grant_id=? AND user_id=? AND version=1').get(grant.id,grant.user_id))throw Error('Full content consent is required in Studio connections settings');
  if(!worker){const file=db.prepare('PRAGMA database_list').all().find(item=>item.name==='main').file;worker=new Worker(new URL('./content-worker.js',import.meta.url),{workerData:{file,siteRoleManagementEnabled:siteRoleManagementEnabled(db)}});worker.unref();worker.on('message',({request,value,error,status})=>{const entry=pending.get(request);if(!entry)return;pending.delete(request);if(!pending.size)worker.unref();if(error)entry.reject(Object.assign(Error(error),{status}));else entry.resolve(value);});worker.on('error',error=>{for(const entry of pending.values())entry.reject(error);pending.clear();worker=null;});}
  const request=randomUUID();worker.ref();return new Promise((resolve,reject)=>{pending.set(request,{resolve,reject});worker.postMessage({request,uid:grant.user_id,grantId:grant.id,kind,args,...extra});});
 }
 function argumentsFor(args){const spec=resourceSpec(args.resource);
  for(const [key,allowed] of Object.entries({ownerId:args.resource==='shared_projects',memberId:!!spec.member,projectId:!!(spec.project||spec.shoot||spec.projectCollection),noteId:!!spec.entry,blockId:!!spec.blocks,book:!!spec.annotation||args.resource==='bible',chapter:!!spec.annotation||args.resource==='bible',verse:!!spec.annotation,passage:args.resource==='bible',version:args.resource==='bible'}))if(args[key]!==undefined&&!allowed)throw Error('Argument does not apply to this resource: '+key);
const permitted=['resource','id','field','blockId','ownerId','memberId','projectId','noteId','book','chapter','verse','passage','version','query','offset','limit'];if(Object.keys(args).some(key=>!permitted.includes(key)))throw Error('Unsupported content arguments');if(args.offset!==undefined&&(!Number.isSafeInteger(args.offset)||args.offset<0))throw Error('Invalid offset');if(args.limit!==undefined&&(!Number.isSafeInteger(args.limit)||args.limit<1||args.limit>100))throw Error('Limit must be 1–100');if(args.query!==undefined&&(typeof args.query!=='string'||args.query.length>200))throw Error('Search query too long');return args;}
 return {close,manifest:resourceManifest,consentVersion:grant=>db.prepare('SELECT version FROM integration_content_consents WHERE grant_id=? AND user_id=?').get(grant.id,grant.user_id)?.version||0,
  read:(grant,args)=>execute(grant,'read',argumentsFor(args)),
  async propose(grant,args,values,revision){
   argumentsFor(args);db.prepare('DELETE FROM integration_content_proposals WHERE expires<=?').run(Date.now());if(typeof revision!=='string'||!/^[a-f0-9]{64}$/.test(revision))throw Error('Read content and use its revision first');
   if(db.prepare('SELECT count(*) n FROM integration_content_proposals WHERE grant_id=? AND expires>?').get(grant.id,Date.now()).n>=20)throw Error('Too many pending proposals');
   const id=randomUUID(),preview=await execute(grant,'preview',args,{values,baseline:revision,proposalId:id}),expires=Date.now()+600000;
   // Keep the exact request and baseline, not a preview copy with transient generated IDs.
   db.prepare('INSERT INTO integration_content_proposals VALUES(?,?,?,?,?)').run(id,grant.id,grant.user_id,JSON.stringify({args,values,revision}),expires);
   return {proposalId:id,requiresConfirmation:true,expires,impact:{resource:args.resource,...(args.resource==='catalog'?{shared:true,visibility:'Shared equipment catalog metadata is visible to other Studio accounts.'}:{}),id:args.id||null,operation:args.id?'update':'add',fields:Object.keys(values),values,previewIdsAreTemporary:true,preview:preview.preview},warning:'No changes applied. Read/write permissions and content revision are checked again on confirmation.'};
  },
  async apply(grant,id){const row=db.prepare('SELECT body FROM integration_content_proposals WHERE id=? AND user_id=? AND grant_id=? AND expires>?').get(id,grant.user_id,grant.id,Date.now());if(!row)throw Error('Proposal unavailable or expired');const {args,values,revision}=JSON.parse(row.body);return execute(grant,'apply',args,{values,baseline:revision,proposalId:id});},
  owns: (grant,id)=>typeof id==='string'&&Boolean(db.prepare('SELECT id FROM integration_content_proposals WHERE id=? AND user_id=? AND grant_id=?').get(id,grant.user_id,grant.id)),
  cancel(grant,id){const content=db.prepare('DELETE FROM integration_content_proposals WHERE id=? AND user_id=? AND grant_id=?').run(id,grant.user_id,grant.id);const project=db.prepare('DELETE FROM integration_proposals WHERE id=? AND user_id=? AND grant_id=?').run(id,grant.user_id,grant.id);return {cancelled:content.changes+project.changes>0};}
 };
}
