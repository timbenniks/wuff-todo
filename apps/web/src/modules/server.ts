import { registerNotesMcp } from "./notes/mcp";
import { processGithubJobs, processAgentJobs } from "@wuff/domain/modules/todo";
import { empireModules } from "@wuff/contracts";
import { registerTodoMcp } from "./todo/mcp";
import { registerTotakeMcp } from "./totake/mcp";
import type { EmpireAppId } from "@wuff/contracts";
import type { ModuleMcpContext } from "@/lib/mcp-context";
export const moduleServers = {
  notes: { registerMcp: registerNotesMcp, background: [] },
  todo: {
    registerMcp: registerTodoMcp,
    background: [processGithubJobs, processAgentJobs],
  },
  totake: { registerMcp: registerTotakeMcp, background: [] },
} satisfies Record<
  EmpireAppId,
  {
    registerMcp: (context: ModuleMcpContext) => void;
    background: readonly (() => Promise<unknown>)[];
  }
>;

export const moduleBackgroundJobs = empireModules.flatMap(
  (module) => moduleServers[module.id].background,
);
