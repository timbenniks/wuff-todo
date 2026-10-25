import type { EmpireModule } from "../../module-types";
export const notesModule = {
 id:"notes",name:"Wuff Notes",href:"/notes",routes:["/notes"],settingsHref:"/settings/notes",
 status:"available",hasDashboard:true,description:"Ideas, de-tails and inspiration. A place to keep them close.",
 defaults:{visible:true,dashboard:false},settings:[["/settings/notes","Preferences"]],
 dashboard:[{id:"notes.summary"}],theme:"sand",
 permissions:[{scope:"notes:read",label:"Notes: read accessible notes, boards and images"},{scope:"notes:write",label:"Notes: create/edit notes, boards and personal choices"},{scope:"notes:manage",label:"Notes: share owned notes and manage trash"}],
 mcpGroups:[{id:"notes",title:"Wuff Notes",order:80}],
} as const satisfies Omit<EmpireModule,"mcpTools">;
