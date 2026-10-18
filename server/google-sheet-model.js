import {createHash} from 'node:crypto';
export const sheetColumns=[['id','장비 ID'],['name','장비명'],['category','분류'],['inventoryCode','관리번호'],['serialNumber','시리얼 번호'],['model','모델'],['trackingMode','관리 방식'],['quantity','수량'],['storageLocation','보관 장소'],['condition','상태'],['custodian','관리자']];
const categories={camera:'카메라',lens:'렌즈',lighting:'조명',tripod:'삼각대',sd:'SD 카드',audio:'음향',other:'기타 장비'};
const fail=message=>Object.assign(Error(message),{status:409});
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function sheetRecord(item){return Object.fromEntries(sheetColumns.map(([key])=>[key,key==='quantity'?Number(item[key]??1):String(item[key]??(key==='category'?'other':key==='trackingMode'?'individual':''))]));}
export function readSheetRows(values,linkId){
 if(!Array.isArray(values)||values.length>2001)throw fail('시트는 최대 2,000행까지 연결할 수 있습니다.');
 if(!values.length)return [];
 if(sheetColumns.some(([,label],i)=>values[0][i]!==label))throw fail('시트 첫 행의 열 제목을 확인하세요. 연결 안내의 양식을 사용해 주세요.');
 const seen=new Set();return values.slice(1).flatMap((cells,index)=>{
  if(!Array.isArray(cells)||cells.every(value=>value===''||value==null))return [];
  if(cells.length>sheetColumns.length&&cells.slice(sheetColumns.length).some(v=>v!==''&&v!=null))throw fail(`${index+2}행: 연결 영역에는 장비 열만 입력하세요.`);
  const result=Object.fromEntries(sheetColumns.map(([key],i)=>[key,String(cells[i]??'').trim()]));
  result.category=Object.entries(categories).find(([key,label])=>result.category===key||result.category===label)?.[0]||(!result.category?'other':result.category);
  result.trackingMode=({'개별':'individual','수량':'bulk'})[result.trackingMode]||result.trackingMode||'individual';
  if(!result.quantity)result.quantity='1';if(!/^\d+$/.test(result.quantity))throw fail(`${index+2}행: 수량은 0 이상의 정수여야 합니다.`);result.quantity=Number(result.quantity);
  if(!result.id)result.id='gs-'+fingerprint([linkId,values,index]).slice(0,36);
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(result.id)||seen.has(result.id))throw fail(`${index+2}행: 장비 ID가 중복되었거나 올바르지 않습니다.`);seen.add(result.id);
  if(!result.name||Object.values(result).some(v=>typeof v==='string'&&v.length>2000)||!Object.hasOwn(categories,result.category)||!['individual','bulk'].includes(result.trackingMode)||!Number.isSafeInteger(result.quantity)||result.quantity<0||(result.trackingMode==='individual'&&result.quantity!==1))throw fail(`${index+2}행: 장비명, 분류, 관리 방식과 수량을 확인하세요.`);
  return [result];
 });
}
export function writeSheetRows(rows){return [sheetColumns.map(([,label])=>label),...rows.map(row=>sheetColumns.map(([key])=>row[key]))];}
// Three-way, field-level merge. Deleting a modified row is also a conflict.
export function mergeSheetRows(base,local,remote){
 const maps=[base,local,remote].map(rows=>new Map(rows.map(row=>[row.id,row]))),result=[];
 for(const id of new Set([...maps[1].keys(),...maps[2].keys(),...maps[0].keys()])){
  const [before,left,right]=maps.map(map=>map.get(id));
  if(!left||!right){if(!before){if(left||right)result.push(left||right);continue;}const remaining=left||right;if(remaining&&fingerprint(remaining)!==fingerprint(before))throw fail(`${remaining.name}: 삭제와 수정이 충돌합니다. 앱과 시트의 내용을 맞춘 뒤 다시 동기화하세요.`);continue;}
  const merged={id};for(const [key]of sheetColumns.slice(1)){const a=left[key],b=right[key],old=before?.[key];if(a===b)merged[key]=a;else if(before&&a===old)merged[key]=b;else if(before&&b===old)merged[key]=a;else throw fail(`${left.name}: ${sheetColumns.find(([k])=>k===key)[1]} 변경이 충돌합니다. 앱과 시트의 내용을 맞춘 뒤 다시 동기화하세요.`);}result.push(merged);
 }
 return result;
}
