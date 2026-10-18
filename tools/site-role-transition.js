// Operator input and resulting plan are private runtime information: do not paste
// real identity values into arguments, source, CI logs, issues or screenshots.
import {DatabaseSync} from 'node:sqlite';
import {lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {planSiteRoleTransition,applySiteRoleTransition} from '../server/site-role-transition.js';
let db;
try{
 const args=process.argv.slice(2);if(args.some(arg=>arg!=='--apply')||args.length>1)throw Error('Use no arguments for read-only planning, or --apply with an explicit stdin snapshot');
 if(!process.env.DATA_DIR?.trim())throw Error('DATA_DIR must explicitly identify an existing installation');
 const dir=resolve(process.env.DATA_DIR),file=join(dir,'studio.sqlite');if(!(await lstat(file)).isFile())throw Error('Existing regular database file required');
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw Error('Input exceeds limit');}const input=JSON.parse(raw);
 const apply=args.includes('--apply');db=new DatabaseSync(file,{readOnly:!apply});db.exec('PRAGMA foreign_keys=ON');
 const result=apply?await applySiteRoleTransition(db,dir,input):{dryRun:true,...planSiteRoleTransition(db,input)};
 process.stdout.write(JSON.stringify(result)+'\n');
}catch(error){process.stderr.write(JSON.stringify({ok:false,error:error.code||'TRANSITION_FAILED',message:['INVALID_INPUT','SNAPSHOT_REQUIRED','TRANSITION_BLOCKED','SNAPSHOT_CHANGED','SCHEMA_INCOMPLETE'].includes(error.code)?error.message:'Transition failed; verify private input and existing data directory. No identity values are logged.'})+'\n');process.exitCode=1;}finally{db?.close();}
