import {creditCategories,emptyGraduation} from './school-graduation.js';
// An area dialog edits one explicitly chosen group. It cannot change course
// classification, another group's rows or existing category mappings.
export function setRequirementArea(school,input,newId){
 if(!input||Object.keys(input).some(k=>!['group','areaId','creditCategory','name','requiredCredits'].includes(k))||!['major','liberal','elective'].includes(input.group))throw Error('전공·교양·일반 영역을 확인하세요.');
 const required=input.requiredCredits;if(!(required===null||typeof required==='number'&&Number.isFinite(required)&&required>=0&&required<=100000&&Math.abs(required*100-Math.round(required*100))<1e-7))throw Error('필요 학점은 비워 두거나 0 이상의 학점으로 입력하세요.');
 const settings=school.graduation||emptyGraduation(),area=input.areaId===undefined?null:settings.areas.find(a=>a.id===input.areaId);
 if(input.areaId!==undefined&&(!area||area.group!==input.group))throw Error('선택한 영역의 항목을 다시 확인하세요.');
 const category=creditCategories.find(c=>c.id===input.creditCategory),custom=input.creditCategory==='custom:'+input.group;
 if(!area&&(!category&&!custom||category&&category.group!==input.group))throw Error('현재 영역의 구분만 선택하세요.');
 if(area&&input.creditCategory!==undefined)throw Error('기존 구분 연결은 이수 구분 연결에서 변경하세요.');
 if(!area&&category&&settings.mappings[category.id])throw Error('이미 등록된 구분입니다. 기존 항목을 수정하세요.');
 if(input.name!==undefined&&(typeof input.name!=='string'||input.name.length>100))throw Error('직접 입력 이름은 100자 이내로 입력하세요.');
 const name=area?(input.name===undefined?area.name:input.name.trim()):category?category.name:input.name?.trim();if(!name)throw Error('직접 입력할 이름을 입력하세요.');
 if(!area&&(typeof newId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(newId)||settings.areas.some(a=>a.id===newId)))throw Error('새 항목 ID를 확인하세요.');
 school.graduation=settings;if(area)Object.assign(area,{name,requiredCredits:required});else{settings.areas.push({id:newId,name,group:input.group,requiredCredits:required});if(category)settings.mappings[category.id]=newId;}
}
