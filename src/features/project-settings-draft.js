export const projectSettingsFields=['name','description','icon','color','date','time','location'];
export function projectSettingsChanged(draft,project){return projectSettingsFields.some(key=>String(draft[key]??'')!==String(project[key]??''));}
export function projectSettingsValues(form){const values=Object.fromEntries(new FormData(form));return Object.fromEntries(projectSettingsFields.map(key=>[key,String(values[key]??'')]));}
