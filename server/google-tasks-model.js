import {createHash} from 'node:crypto';
import {validDate} from '../src/domain/calendar.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const taskFingerprint=task=>hash(task);
export const taskRemoteStamp=task=>JSON.stringify([task.etag||'',task.updated||'']);
export const taskMarker=(uid,subject,pid,id)=>'[Studio link:'+hash([uid,subject,pid,id])+']';
export function taskMetadata(project,task,marker,remote){
 if(typeof task.name!=='string'||!task.name.trim()||task.name.length>1024)throw Object.assign(Error('Google Tasks 제목은 1024자까지입니다. Studio 원본은 유지합니다.'),{status:422});
 const shoot=project.contents.find(item=>item.id===task.shootId),line='Studio 연결: '+project.project.name+(shoot?' / '+shoot.name:'');let notes;
 if(remote){const lines=String(remote.notes||'').split('\n');if(!lines.includes(marker))throw Object.assign(Error('연결 표식이 없는 Google 할 일은 수정하지 않습니다.'),{status:409});const index=lines.findIndex(value=>value.startsWith('Studio 연결: '));if(index<0)lines.push(line);else lines[index]=line;notes=lines.join('\n');}else notes=marker+'\n'+line;
 if(notes.length>8192)throw Object.assign(Error('Google 개인 메모를 보존하기 위해 연동을 중지했습니다. 메모 길이를 확인하세요.'),{status:422});
 if(task.date&&!validDate(task.date))throw Object.assign(Error('할 일 날짜를 확인하세요.'),{status:422});
 return {title:task.name,notes,due:task.date?task.date+'T00:00:00.000Z':null};
}
export const taskMetadataHash=(project,task)=>hash([task.name,task.date||'',project.project.name,project.contents.find(item=>item.id===task.shootId)?.name||'']);
export function validateRemoteTask(task,marker){if(task.deleted)throw Object.assign(Error('Google에서 삭제된 할 일은 자동 삭제·재생성하지 않습니다.'),{status:409});if(task.parent||task.assignmentInfo)throw Object.assign(Error('Google 하위·할당 항목은 이 연동에서 지원하지 않습니다.'),{status:422});if(!['needsAction','completed'].includes(task.status))throw Object.assign(Error('Google 완료 상태를 확인할 수 없습니다.'),{status:422});if(!String(task.notes||'').split('\n').includes(marker))throw Object.assign(Error('연결 표식이 없는 개인 할 일은 가져오지 않습니다.'),{status:409});}
export function taskConflictKey(task,remote,generation){return hash([taskFingerprint(task),taskRemoteStamp(remote),remote.status,generation]);}
