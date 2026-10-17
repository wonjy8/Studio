import {emptyWorkspace,validateWorkspace,workspaceFileIds} from '../src/domain/workspace.js';
export function readWorkspace(db,uid){const row=db.prepare('SELECT revision,body FROM workspaces WHERE user_id=?').get(uid);return row?{revision:row.revision,state:JSON.parse(row.body)}:{revision:0,state:emptyWorkspace()};}
export function writeWorkspace(db,uid,state,revision){
 if(!Number.isSafeInteger(revision)||!validateWorkspace(state))throw Object.assign(Error('Invalid workspace'),{status:400});
 if(workspaceFileIds(state).some(id=>!db.prepare('SELECT id FROM files WHERE id=? AND user_id=?').get(id,uid)))throw Object.assign(Error('Invalid file reference'),{status:400});
 const row=db.prepare('SELECT revision FROM workspaces WHERE user_id=?').get(uid);
 if((row?.revision||0)!==revision)throw Object.assign(Error('Workspace changed. Reload before editing.'),{status:409});
 db.prepare('INSERT INTO workspaces VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(uid,revision+1,JSON.stringify(state));
 return {revision:revision+1};
}
