import { createTodoMcpView } from "./todo/mcp-app";
import { renderTotake } from "./totake/mcp-app";
import { empireModules } from "@wuff/contracts";
import type { EmpireAppId, TotakeSnapshot } from "@wuff/contracts";
import type { McpViewRuntime, McpView } from "@/mcp-app/runtime";
export function createModuleMcpViews(runtime: McpViewRuntime): McpView[] {
  const views = {
    todo: createTodoMcpView(runtime),
    totake: {
      matches: (data) => Boolean(data.totake),
      render: (data) =>
        renderTotake(
          runtime,
          data.totake as TotakeSnapshot,
          data.totakeCanWrite !== false,
        ),
    },
  } satisfies Record<EmpireAppId, McpView>;
  return empireModules.map((module) => views[module.id]);
}
