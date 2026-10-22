export const workspaceSettingsContexts={
 'workspace-home-settings':{id:'home',view:'workspace-home',name:'홈'},
 'school-settings':{id:'school',view:'school',name:'학교'},
 'scripture-settings':{id:'scripture',view:'scripture',name:'말씀'},
 'equipment-workspace-settings':{id:'equipment',view:'member-equipment',name:'장비'},
 'materials-workspace-settings':{id:'materials',view:'materials',name:'자료'},
 'project-workspace-settings':{id:'project',view:'home',name:'프로젝트'}
};
export const settingsViewFor=id=>Object.keys(workspaceSettingsContexts).find(view=>workspaceSettingsContexts[view].id===(id.startsWith('project:')?'project':id));
export const settingsContextView=view=>workspaceSettingsContexts[view]?.view||view;
