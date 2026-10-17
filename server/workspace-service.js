import {reconcileEquipment} from './equipment.js';
import {emptyWorkspace,validateWorkspace,workspaceFileIds} from '../src/domain/workspace.js';
export function readWorkspace(db,uid){const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(uid);return row?{revision:row.revision,state:reconcileEquipment(db,uid,JSON.parse(row.body))}:{revision:0,state:emptyWorkspace()};}
export function writeWorkspace(db,uid,state,revision){
 state=structuredClone(state);
 if(!Number.isSafeInteger(revision)||!validateWorkspace(state))throw Object.assign(Error('Invalid workspace'),{status:400});
 if(workspaceFileIds(state).some(id=>!db.prepare('SELECT id FROM files WHERE id=? AND user_id=?').get(id,uid)))throw Object.assign(Error('Invalid file reference'),{status:400});
 const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(uid);
 if((row?.revision||0)!==revision)throw Object.assign(Error('Workspace changed. Reload before editing.'),{status:409});
 db.exec('SAVEPOINT equipment_workspace');
 try{reconcileEquipment(db,uid,state,{write:true,previous:row?JSON.parse(row.body):undefined});
 if(!validateWorkspace(state))throw Object.assign(Error('Invalid reconciled workspace'),{status:400});
 db.prepare('INSERT INTO workspaces VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(uid,revision+1,JSON.stringify(state));
 db.exec('RELEASE equipment_workspace');
 }catch(e){db.exec('ROLLBACK TO equipment_workspace');db.exec('RELEASE equipment_workspace');throw e;}
 return {revision:revision+1,state};
}
