import {
  totakeEngine as te,
  type TotakeSnapshot,
  type TotakeMutation,
  type TotakeAction,
} from "@wuff/contracts";
import { element, button } from "@/mcp-app/dom";
import { ToolError, type McpViewRuntime } from "@/mcp-app/runtime";
export function renderTotake(
  runtime: McpViewRuntime,
  data: TotakeSnapshot,
  canWrite: boolean,
) {
  const { root, status, webOrigin, request, show, call } = runtime;
  root.classList.add("totake-view");
  const state = data.state,
    today = Math.floor(state.now / 1440);
  const title = element("h1", "Wuff Totake");
  root.append(title);
  const link = element("a", "Open full Totake");
  link.href = new URL("/totake", webOrigin).href;
  link.target = "_blank";
  link.rel = "noopener";
  root.append(link);
  root.append(element("p", data.delivery.message));
  const controls: HTMLButtonElement[] = [],
    feedback = element("div");
  feedback.setAttribute("role", "status");
  root.append(feedback);
  let pending: TotakeMutation | null = null,
    busy = false;
  async function send(input: TotakeMutation) {
    if (busy) return;
    busy = true;
    pending = input;
    controls.forEach((c) => (c.disabled = true));
    feedback.replaceChildren(element("p", "Saving…"));
    try {
      const result = (await request("update_totake", input)) as {
        totake: TotakeSnapshot;
      };
      pending = null;
      show({ ...result, totakeCanWrite: canWrite });
      status.textContent = "Totake change saved.";
    } catch (error) {
      feedback.replaceChildren(element("p", (error as Error).message));
      feedback.setAttribute("role", "alert");
      if (!(error instanceof ToolError) || error.code === "internal_error")
        feedback.append(
          button("Retry same request", () => void send(pending!)),
        );
      else {
        pending = null;
        feedback.append(
          button("Load latest Totake", () => void call("show_totake", {})),
        );
      }
    } finally {
      busy = false;
    }
  }
  const save = (change: TotakeAction) => {
    if (!pending)
      void send({
        version: data.version,
        operationId: crypto.randomUUID(),
        change,
      });
  };
  const groups = state.groups.filter(
    (g) => te.pending(g).length && Math.floor(g.due / 1440) <= today,
  );
  root.append(element("h2", "Today and unresolved reminders"));
  if (!groups.length)
    root.append(element("p", "No unresolved reminders for today."));
  for (const g of groups.slice(0, 5)) {
    const section = element("section");
    section.append(element("h3", `${te.date(g.due)} · ${te.time(g.due)}`));
    const ids = new Set(te.pending(g).map((i) => i.id));
    const selectionButtons: {
      button: HTMLButtonElement;
      available: () => boolean;
    }[] = [];
    for (const item of te.pending(g)) {
      const label = element("label"),
        check = element("input");
      check.type = "checkbox";
      check.checked = true;
      check.disabled = !canWrite;
      check.onchange = () => {
        if (check.checked) ids.add(item.id);
        else ids.delete(item.id);
        selectionButtons.forEach(
          (b) =>
            (b.button.disabled =
              !canWrite || !ids.size || busy || !b.available()),
        );
      };
      label.append(
        check,
        document.createTextNode(`${item.name} · ${item.dose}`),
      );
      section.append(label);
    }
    const add = (
      text: string,
      change: () => TotakeAction,
      available = () => true,
    ) => {
      const b = button(text, () => save(change()), !canWrite || !available());
      selectionButtons.push({ button: b, available });
      controls.push(b);
      section.append(b);
    };
    add("Mark selected as taken/done", () => ({
      action: "record",
      groupId: g.id,
      itemIds: [...ids],
      outcome: "taken",
    }));
    add("Skip selected", () => ({
      action: "record",
      groupId: g.id,
      itemIds: [...ids],
      outcome: "skipped",
    }));
    const minutes = element("select");
    minutes.setAttribute(
      "aria-label",
      `Snooze duration for ${te.date(g.due)} ${te.time(g.due)}`,
    );
    for (const n of [15, 30, 45, 60]) {
      const o = element("option", `${n} minutes`);
      o.value = String(n);
      o.selected = n === 30;
      minutes.append(o);
    }
    section.append(minutes);
    add(
      "Snooze selected",
      () => ({
        action: "snooze",
        groupId: g.id,
        itemIds: [...ids],
        minutes: Number(minutes.value) as 30,
      }),
      () =>
        te
          .pending(g)
          .filter((i) => ids.has(i.id))
          .every((i) => (i.alertInstant ?? Infinity) <= state.clock!.instant),
    );
    root.append(section);
  }
  if (groups.length > 5)
    root.append(
      element(
        "p",
        `Showing 5 of ${groups.length} groups. Open full Totake for all reminders.`,
      ),
    );
  const history = element("details");
  history.append(element("summary", "Recorded today"));
  for (const g of state.groups.filter(
    (g) => Math.floor(g.due / 1440) === today,
  ))
    for (const r of g.records) {
      const row = element("div"),
        item = g.items.find((i) => i.id === r.itemId);
      row.append(
        element(
          "p",
          `${te.time(g.due)} · ${item?.name ?? "Recorded item"} · ${r.outcome === "skipped" ? "Skipped" : item?.kind === "equipment" ? "Done" : "Taken"}`,
        ),
      );
      const b = button(
        "Undo",
        () => save({ action: "undo", groupId: g.id, recordId: r.id }),
        !canWrite,
      );
      controls.push(b);
      row.append(b);
      history.append(row);
    }
  root.append(history);
}
