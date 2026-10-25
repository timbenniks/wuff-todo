import { notesModule } from "./modules/notes/manifest";
import { notesMcpTools } from "./modules/notes/mcp-catalog";
import { todoMcpTools } from "./modules/todo/mcp-catalog";
import { totakeMcpTools } from "./modules/totake/mcp-catalog";
import { createModuleRegistry } from "./module-types";
import { todoModule } from "./modules/todo/manifest";
import { totakeModule } from "./modules/totake/manifest";
export {
  createModuleRegistry,
  moduleForPath,
  type EmpireModule,
} from "./module-types";
/** The one composition point for installed products. Preferences never unload authorization. */
export const empireModules = createModuleRegistry([
  { ...todoModule, mcpTools: todoMcpTools },
  { ...totakeModule, mcpTools: totakeMcpTools },
  { ...notesModule, mcpTools: notesMcpTools },
] as const);
