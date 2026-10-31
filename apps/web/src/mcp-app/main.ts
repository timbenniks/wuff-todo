import { App } from "@modelcontextprotocol/ext-apps";
import { resetListTheme } from "@wuff/design";
import type { EmpireSettings } from "@wuff/contracts";
import { wuffCopy, wuffError } from "@wuff/ui/features/lib/copy";
import { ToolError, type McpViewRuntime, type McpView } from "./runtime";
import { renderEmpireSettings } from "./empire-settings";
import { createModuleMcpViews } from "@/modules/mcp-ui";
const app = new App({ name: "Wuff Empire", version: "0.3.0" }, {});
const root = document.querySelector<HTMLElement>("#app")!;
const status = document.querySelector<HTMLElement>("#status")!;
let webOrigin = "https://wuff-todo.vercel.app";
async function request(name: string, args: Record<string, unknown>) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError)
    throw new ToolError(
      result.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join(" ") ||
        "Ruff patch! Couldn’t save. Reopen the list and try again.",
      (result.structuredContent as { error?: { code: string } } | undefined)
        ?.error?.code ?? "internal_error",
    );
  return result.structuredContent;
}
async function call(name: string, args: Record<string, unknown>) {
  status.textContent = wuffCopy.saving;
  try {
    show(await request(name, args));
    status.textContent = wuffCopy.saved;
  } catch (e) {
    status.textContent = wuffError((e as Error).message);
  }
}
const runtime: McpViewRuntime = {
  callServerTool: app.callServerTool.bind(app),
  root,
  status,
  get webOrigin() {
    return webOrigin;
  },
  request,
  call,
  show,
};
const moduleViews = createModuleMcpViews(runtime);
const platformView: McpView = {
  matches: (data) => Boolean(data.empireSettings),
  render: (data) =>
    renderEmpireSettings(
      runtime,
      data.empireSettings as EmpireSettings,
      data.empireCanManage !== false,
    ),
};
function show(value: unknown) {
  if (!value || typeof value !== "object") return;
  const data = value as Record<string, unknown>;
  const view = [platformView, ...moduleViews].find((view) =>
    view.matches(data),
  );
  if (!view) return; // Preserve drafts for errors/unrelated tool results.
  if (typeof data.webOrigin === "string") webOrigin = data.webOrigin;
  for (const module of moduleViews) module.beforeShow?.(data);
  root.replaceChildren();
  root.classList.remove("totake-view");
  resetListTheme(document.documentElement);
  view.render(data);
}
app.ontoolresult = (result) => show(result.structuredContent);
app.connect().catch(() => {
  status.textContent =
    "This view needs a helping paw. Open it in a client that supports MCP Apps.";
});
