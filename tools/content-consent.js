// Prepare/review a grant-specific consent operation. Defaults to read-only.
// Never run against production without identifying the owner and explicit approval.
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
const argv=process.argv.slice(2),arg=name=>argv[argv.indexOf(name)+1];
if(!argv.includes('--user')||!argv.includes('--connection'))throw Error('Usage: DATA_DIR=... node tools/content-consent.js --user EXACT_USERNAME --connection UUID [--approve]');
const user=arg('--user'),id=arg('--connection');if(!/^[a-f0-9-]{36}$/.test(id))throw Error('An exact connection UUID is required');
const db=new DatabaseSync(join(process.env.DATA_DIR||'./data','studio.sqlite'),{readOnly:!argv.includes('--approve')});
try{
 const row=db.prepare('SELECT g.id,g.user_id,u.username,g.scope,g.created_at,g.refresh_expires FROM oauth_grants g JOIN users u ON u.id=g.user_id WHERE u.username=? AND g.id=? AND g.revoked=0 AND g.refresh_expires>?').get(user,id,Date.now());
 if(!row)throw Error('Active connection not found for that exact account');
 const consent=db.prepare('SELECT version FROM integration_content_consents WHERE grant_id=? AND user_id=?').get(id,row.user_id);
 if(argv.includes('--approve')){db.exec('BEGIN IMMEDIATE');try{const live=db.prepare('SELECT id FROM oauth_grants WHERE id=? AND user_id=? AND revoked=0 AND refresh_expires>?').get(id,row.user_id,Date.now());if(!live)throw Error('Connection changed');db.prepare('INSERT INTO integration_content_consents VALUES(?,?,1,?) ON CONFLICT(grant_id) DO UPDATE SET version=1,approved_at=excluded.approved_at').run(id,row.user_id,Date.now());db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
 process.stdout.write(JSON.stringify({username:row.username,connectionId:id,scope:row.scope,previousConsentVersion:consent?.version||0,approved:argv.includes('--approve'),data:'Account-visible project/content, documents, inventory/materials and private scripture/QT/gratitude/prayer/annotations; excludes account/settings/admin/permission changes'})+'\n');
}finally{db.close();}
