import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { totakeQuerySchema, totakeMutationSchema } from "@wuff/contracts";
import * as domain from "@wuff/domain/modules/totake";
import type { ModuleMcpContext } from "@/lib/mcp-context";
export function registerTotakeMcp({
  actor,
  registerTool,
  uri,
  read,
  write,
  result,
}: ModuleMcpContext) {
  registerAppTool(
    { registerTool },
    "show_totake",
    {
      title: "Wuff Totake",
      description:
        "Open your private Totake daily overview with selected Taken/Done, Skip, Snooze and Undo controls. Requires totake:read; actions require totake:write.",
      inputSchema: {},
      annotations: read,
      _meta: { ui: { resourceUri: uri } },
    },
    async (input) =>
      result(async () => ({
        totake: await domain.getTotake(actor, input),
        totakeCanWrite: actor.scopes.includes("totake:write"),
      })),
  );
  registerTool(
    "get_totake_summary",
    {
      description:
        "Read bounded personal Totake counts and next five reminder groups without medication names. Requires totake:read.",
      inputSchema: {},
      annotations: read,
    },
    async () =>
      result(async () => ({ summary: await domain.getTotakeSummary(actor) })),
  );
  registerTool(
    "get_totake",
    {
      description:
        "Read your private Totake treatments, scheduled occurrences, records, stock and repeat settings. Requires totake:read. No Todo sharing grants access. Delivery status is separate from saved schedules. Optional day is a UTC-calendar day index since 1970, within one year of today.",
      inputSchema: totakeQuerySchema.shape,
      annotations: read,
    },
    async (input) =>
      result(async () => ({
        totake: await domain.getTotake(actor, input),
        totakeCanWrite: actor.scopes.includes("totake:write"),
      })),
  );
  registerTool(
    "update_totake",
    {
      description:
        "Change personal Totake data. Requires totake:read and totake:write. Read get_totake first; supply current version and a fresh operationId. Retry uncertain outcomes with IDENTICAL arguments. change.action selects save_treatment, record, snooze, undo, record_intake, undo_intake, adjust_stock, move_reminder or settings. Record/skip/snooze only explicit unresolved itemIds. Never infer medication doses or mark taken without the user saying they took it. Moving dates requires explicit one/future scope. Count-only stock; no liquid/drop tracking. Existing grants do not acquire Totake permissions.",
      inputSchema: totakeMutationSchema.shape,
      annotations: write,
    },
    async (input) =>
      result(async () => ({ totake: await domain.updateTotake(actor, input) })),
  );
}
