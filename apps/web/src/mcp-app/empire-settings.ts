import {
  empireAppPreference,
  type EmpireSettings,
  type EmpireSettingsUpdate,
} from "@wuff/contracts";
import { element, button, wireForm } from "@/mcp-app/dom";
import { ToolError, type McpViewRuntime } from "@/mcp-app/runtime";
export function renderEmpireSettings(
  runtime: McpViewRuntime,
  data: EmpireSettings,
  canManage: boolean,
) {
  const { root, status, webOrigin, request, show, call } = runtime;
  const heading = element("h1", "Your Wuff Empire");
  const description = element(
    "p",
    "Choose apps and summaries for your menu and homepage. Hiding keeps data, reminders and connections.",
  );
  const form = element("form");
  form.className = "empire-settings-form";
  const controls: HTMLInputElement[] = [];
  const draft = structuredClone(data.apps);
  const feedback = element("div");
  feedback.setAttribute("role", "status");
  const save = button("Save choices", () => {}, true);
  save.type = "submit";
  const cancel = button(
    "Cancel changes",
    () => void call("get_empire_settings", {}),
  );
  const changes = () =>
    data.catalog.flatMap((app) => {
      const before = empireAppPreference(data.apps, app.id),
        after = empireAppPreference(draft, app.id);
      return before.visible === after.visible &&
        before.dashboard === after.dashboard
        ? []
        : [
            {
              appId: app.id,
              visible: after.visible,
              ...(app.hasDashboard ? { dashboard: after.dashboard } : {}),
            },
          ];
    });
  let pending: EmpireSettingsUpdate | null = null,
    busy = false;
  for (const app of data.catalog) {
    const section = element("fieldset");
    section.append(element("legend", app.name));
    for (const field of ["visible", "dashboard"] as const) {
      const label = element("label");
      const input = element("input");
      input.type = "checkbox";
      input.checked = empireAppPreference(draft, app.id)[field];
      const available =
        canManage && (field !== "dashboard" || app.hasDashboard);
      input.disabled = !available;
      input.dataset.available = String(available);
      input.onchange = () => {
        draft[app.id] = {
          ...empireAppPreference(draft, app.id),
          [field]: input.checked,
        };
        save.disabled = !canManage || !changes().length;
      };
      label.append(
        input,
        document.createTextNode(
          field === "visible" ? `Show ${app.name}` : `Summarize ${app.name}`,
        ),
      );
      section.append(label);
      controls.push(input);
    }
    if (!app.hasDashboard)
      section.append(element("p", "Coming soon · no dashboard summary yet"));
    form.append(section);
  }
  async function send(input: EmpireSettingsUpdate) {
    if (busy) return;
    busy = true;
    cancel.disabled = true;
    pending = input;
    save.disabled = true;
    controls.forEach((control) => {
      control.disabled = true;
    });
    feedback.replaceChildren(element("p", "Saving your choices…"));
    try {
      const result = (await request("update_empire_settings", input)) as {
        empireSettings: EmpireSettings;
      };
      pending = null;
      show(result);
      status.textContent = "Your choices are saved.";
    } catch (error) {
      const uncertain =
        !(error instanceof ToolError) || error.code === "internal_error";
      if (!uncertain) pending = null;
      feedback.replaceChildren(element("p", (error as Error).message));
      feedback.setAttribute("role", "alert");
      if (pending)
        feedback.append(
          button("Retry same request", () => void send(pending!)),
        );
      else {
        cancel.disabled = false;
        controls.forEach((control) => {
          control.disabled = control.dataset.available !== "true";
        });
        feedback.append(
          button(
            "Load latest settings",
            () => void call("get_empire_settings", {}),
          ),
        );
      }
    } finally {
      busy = false;
    }
  }
  wireForm(form, save, () => {
    if (!pending && canManage && changes().length)
      void send({
        version: data.version,
        operationId: crypto.randomUUID(),
        changes: changes(),
      });
  });
  const link = element("a", "Open Empire settings");
  link.href = webOrigin + "/settings/apps";
  link.target = "_blank";
  link.rel = "noreferrer";
  if (!canManage)
    form.append(
      element(
        "p",
        "This connection can read choices. Reconnect with empire:manage to save changes.",
      ),
    );
  form.append(save, cancel, feedback);
  root.append(heading, description, form, link);
}
