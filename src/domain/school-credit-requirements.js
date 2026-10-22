import {creditCategories,emptyGraduation} from './school-graduation.js';
// One-field mutations preserve legacy precision and unrelated category mappings.
export function setCreditRequirement(school,input,newId){
 if(!input||Object.keys(input).some(k=>!['target','key','value'].includes(k))||!(input.value===null||Number.isSafeInteger(input.value)&&input.value>=0&&input.value<=100000))throw Error('필요 학점은 비워 두거나 0 이상의 정수로 입력하세요.');
 const {target,key,value}=input;
 if(target==='overall'&&key==='overall'){school.requiredCredits=value;return;}
 const settings=school.graduation||emptyGraduation();
 if(target==='group'&&['major','liberal'].includes(key)){school.graduation=settings;settings.groupRequiredCredits={...settings.groupRequiredCredits,[key]:value};return;}
 if(target==='area'){const area=settings.areas.find(a=>a.id===key);if(!area)throw Error('기존 영역을 확인하세요.');area.requiredCredits=value;return;}
 if(target==='category'){
  const category=creditCategories.find(c=>c.id===key);if(!category)throw Error('이수 구분을 확인하세요.');
  const area=settings.areas.find(a=>a.id===settings.mappings[key]);if(area){area.requiredCredits=value;return;}
  if(value===null)return;
  if(!newId||settings.areas.some(a=>a.id===newId))throw Error('영역 ID를 확인하세요.');
  school.graduation=settings;settings.areas.push({id:newId,name:category.name,group:category.group,requiredCredits:value});settings.mappings[key]=newId;return;
 }
 throw Error('필요 학점 항목을 확인하세요.');
}
