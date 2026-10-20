import {contentResources} from './content-resources.js';
import {randomUUID} from 'node:crypto';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function rentalVendorRoutes(db,{initialize=true}={}){if(initialize){db.exec('CREATE TABLE IF NOT EXISTS rental_vendors(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,revision INTEGER NOT NULL)');}return async({path,req,session,json,readJson})=>{
 if(!path.startsWith('/api/rental-vendors'))return false;if(!session){json(401,{error:'Login required'});return true;}const uid=session.user_id,match=path.match(/^\/api\/rental-vendors\/([A-Za-z0-9_-]+)$/);
 if(path==='/api/rental-vendors'&&req.method==='GET'){json(200,{vendors:db.prepare('SELECT * FROM rental_vendors WHERE user_id=? ORDER BY rowid DESC').all(uid).map(row=>({id:row.id,...JSON.parse(row.body),revision:row.revision}))});return true;}
 if((path==='/api/rental-vendors'&&req.method==='POST')||(match&&['PUT','DELETE'].includes(req.method))){const data=await readJson(20000);if(!data||typeof data!=='object'||Array.isArray(data))throw fail('Invalid vendor');const old=match&&db.prepare('SELECT * FROM rental_vendors WHERE id=? AND user_id=?').get(match[1],uid);if(match&&!old)throw fail('Not found',404);if(old&&data.revision!==old.revision)throw fail('Vendor changed. Reload before editing.',409);
 if(req.method==='DELETE'){db.prepare('DELETE FROM rental_vendors WHERE id=? AND user_id=? AND revision=?').run(old.id,uid,data.revision);json(200,{ok:true});return true;}
 const fields=contentResources.vendors.fields;if(Object.keys(data).some(key=>!fields.includes(key)&&key!=='revision')||fields.some(key=>data[key]!==undefined&&(typeof data[key]!=='string'||data[key].length>2000))||!data.name?.trim())throw fail('Invalid vendor fields');const next=Object.fromEntries(fields.map(key=>[key,(data[key]||'').trim()]));if(next.website){let url;try{url=new URL(next.website);}catch{throw fail('Invalid website');}if(!['https:','http:'].includes(url.protocol))throw fail('Invalid website');}
 const id=old?.id||randomUUID(),revision=(old?.revision||0)+1;db.prepare('INSERT INTO rental_vendors VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision').run(id,uid,JSON.stringify(next),revision);json(old?200:201,{vendor:{id,...next,revision}});return true;
 }return false;
};}
