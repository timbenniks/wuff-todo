import { App } from "@modelcontextprotocol/ext-apps";
import type { ListOrder, ListSummary, TodoList } from "@wuff/contracts";
import { listColors } from "@wuff/contracts";
import { listPalette } from "../lib/list-colors";
const app = new App({ name: "Wuff Todo", version: "0.2.0" }, {});
let current: TodoList | undefined,
  viewerId = "",
  catalog: ListSummary[] = [],
  archive = false;
const root = document.querySelector<HTMLElement>("#app")!;
const status = document.querySelector<HTMLElement>("#status")!;
async function request(name: string, args: Record<string, unknown>) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError)
    throw new Error(
      result.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join(" ") || "Couldn’t save. Reopen the list and try again.",
    );
  return result.structuredContent;
}
async function call(name: string, args: Record<string, unknown>) {
  status.textContent = "Saving…";
  try {
    show(await request(name, args));
    status.textContent = "Saved";
  } catch (e) {
    status.textContent = (e as Error).message;
  }
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}
function button(text: string, run: () => void, disabled = false) {
  const e = element("button", text);
  e.type = "button";
  e.disabled = disabled;
  e.onclick = run;
  return e;
}
function mutation(name: string, args: Record<string, unknown>) {
  return call(name, {
    listId: current!.id,
    version: current!.version,
    ...args,
    operationId: crypto.randomUUID(),
  });
}
// Some MCP hosts sandbox native form submission. Click/Enter still work through
// explicit event handlers, with native constraint validation and no navigation.
function wireForm(
  form: HTMLFormElement,
  save: HTMLButtonElement,
  run: () => void,
) {
  const submit = () => {
    if (!save.disabled && form.reportValidity()) {
      save.disabled = true;
      run();
    }
  };
  save.type = "button";
  save.onclick = submit;
  form.onsubmit = (e) => {
    e.preventDefault();
    submit();
  };
  form.onkeydown = (e) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      submit();
    }
  };
}
function show(value: unknown) {
  const data = value as {
    list?: TodoList;
    lists?: ListSummary[];
    viewerId?: string;
  };
  if (data.viewerId) viewerId = data.viewerId;
  root.replaceChildren();
  if (data.lists) {
    catalog = data.lists;
    current = undefined;
    renderCatalog();
    return;
  }
  if (!data.list) return;
  current = data.list;
  const color = listPalette[current.color];
  root.append(button("← Your lists", () => void call("show_lists", {})));
  const header = element("div");
  header.className = "list-header";
  header.style.background = color.tint;
  header.style.borderColor = color.accent;
  header.append(element("h1", current.title));
  if (current.description) {
    const p = element("p", current.description);
    p.style.whiteSpace = "pre-wrap";
    header.append(p);
  }
  if (current.archived)
    header.append(
      element("p", "Archived · restore this list before editing tasks."),
    );
  root.append(header);
  const owner = current.ownerId === viewerId;
  if (owner) {
    const settings = element("details"),
      summary = element("summary", "List settings");
    settings.append(summary);
    const form = element("form");
    form.className = "settings";
    const title = element("input");
    title.value = current.title;
    title.required = true;
    title.maxLength = 300;
    title.setAttribute("aria-label", "List name");
    const description = element("textarea");
    description.value = current.description;
    description.maxLength = 4000;
    description.rows = 3;
    description.setAttribute("aria-label", "List description");
    const select = element("select");
    select.setAttribute("aria-label", "List color");
    for (const color of listColors) {
      const o = element("option", listPalette[color].label);
      o.value = color;
      select.append(o);
    }
    select.value = current.color;
    const save = element("button", "Save settings");
    form.append(title, description, select, save);
    wireForm(form, save, () => {
      void mutation("update_list", {
        title: title.value,
        description: description.value,
        color: select.value,
      });
    });
    settings.append(
      form,
      button(
        current.archived ? "Restore list" : "Archive list",
        () => void mutation("update_list", { archived: !current!.archived }),
      ),
    );
    root.append(settings);
  }
  const groups = [
    { id: null, title: current.sections.length ? "No section" : "Tasks" },
    ...current.sections,
  ];
  for (const group of groups) {
    const details = element("details");
    details.open = true;
    details.className = "section";
    details.append(element("summary", group.title));
    for (const task of current.tasks.filter((t) => t.sectionId === group.id)) {
      const row = element("div");
      row.className = "task";
      const check = element("input");
      check.type = "checkbox";
      check.checked = task.completed;
      check.disabled = current.archived;
      check.setAttribute(
        "aria-label",
        `${task.completed ? "Reopen" : "Complete"} ${task.title}`,
      );
      check.onchange = () => {
        check.disabled = true;
        void mutation("update_task", {
          taskId: task.id,
          completed: check.checked,
        });
      };
      const text = element("span", task.title);
      if (task.completed) text.style.textDecoration = "line-through";
      row.append(check, text);
      if (current.sections.length) {
        const select = element("select");
        select.setAttribute("aria-label", `Section for ${task.title}`);
        select.disabled = current.archived;
        for (const g of groups) {
          const o = element("option", g.title);
          o.value = g.id ?? "";
          select.append(o);
        }
        select.value = task.sectionId ?? "";
        select.onchange = () =>
          void mutation("update_task", {
            taskId: task.id,
            sectionId: select.value || null,
          });
        row.append(select);
      }
      details.append(row);
    }
    if (!current.archived) {
      const form = element("form"),
        input = element("input"),
        save = element("button", "Add");
      input.required = true;
      input.maxLength = 300;
      input.placeholder = "Add a task…";
      input.setAttribute("aria-label", `New task in ${group.title}`);
      form.append(input, save);
      wireForm(form, save, () => {
        void mutation("create_task", {
          title: input.value,
          sectionId: group.id,
        });
      });
      details.append(form);
    }
    if (owner && group.id && !current.archived) {
      const id = group.id,
        index = current.sections.findIndex((s) => s.id === id);
      const actions = element("div");
      actions.className = "section-actions";
      for (const [dir, label] of [
        [-1, "up"],
        [1, "down"],
      ] as const) {
        actions.append(
          button(
            `Move ${group.title} ${label}`,
            () => {
              const ids = current!.sections.map((s) => s.id);
              [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
              void mutation("reorder_sections", { sectionIds: ids });
            },
            index + dir < 0 || index + dir >= current.sections.length,
          ),
        );
      }
      // Explicit inline form avoids relying on host support for window.prompt/confirm.
      const edit = element("form"),
        name = element("input"),
        save = element("button", "Rename section");
      name.value = group.title;
      name.required = true;
      name.maxLength = 300;
      name.setAttribute("aria-label", `Rename section ${group.title}`);
      edit.append(name, save);
      wireForm(edit, save, () => {
        void mutation("rename_section", { sectionId: id, title: name.value });
      });
      actions.append(
        edit,
        button(
          `Remove ${group.title} (keep tasks)`,
          () => void mutation("delete_section", { sectionId: id }),
        ),
      );
      details.append(actions);
    }
    root.append(details);
  }
  if (owner && !current.archived && current.sections.length < 50) {
    const form = element("form"),
      input = element("input"),
      save = element("button", "Add section");
    input.placeholder = "Section name";
    input.setAttribute("aria-label", "Section name");
    input.required = true;
    input.maxLength = 300;
    form.append(input, save);
    wireForm(form, save, () => {
      void mutation("create_section", { title: input.value });
    });
    root.append(form);
  }
}
function renderCatalog() {
  root.replaceChildren(
    element("h1", archive ? "Archived lists" : "Your lists"),
  );
  root.append(
    button(archive ? "Back to lists" : "Archive", () => {
      archive = !archive;
      renderCatalog();
    }),
  );
  const visible = catalog.filter((l) => l.archived === archive);
  for (const [i, list] of visible.entries()) {
    const row = element("div");
    row.className = "catalog-row";
    const open = button(
      list.title,
      () => void call("show_list", { listId: list.id }),
    );
    open.className = "list";
    open.style.borderLeft = `5px solid ${listPalette[list.color].accent}`;
    row.append(open);
    for (const [dir, label] of [
      [-1, "up"],
      [1, "down"],
    ] as const) {
      row.append(
        button(
          `Move ${list.title} ${label}`,
          () => void reorder(list.id, visible[i + dir].id),
          i + dir < 0 || i + dir >= visible.length,
        ),
      );
    }
    root.append(row);
  }
  if (!visible.length)
    root.append(
      element(
        "p",
        archive
          ? "No archived lists yet."
          : "Create your first list on Wuff, or ask your AI assistant to create one.",
      ),
    );
}
async function reorder(id: string, target: string) {
  status.textContent = "Saving…";
  try {
    const data = (await request("get_list_order", {})) as { order: ListOrder };
    const ids = [...data.order.listIds],
      a = ids.indexOf(id),
      b = ids.indexOf(target);
    if (a < 0 || b < 0)
      throw new Error(
        "Your lists changed. Reopen the list view and try again.",
      );
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await request("reorder_lists", {
      listIds: ids,
      version: data.order.version,
      operationId: crypto.randomUUID(),
    });
    show(await request("show_lists", {}));
    status.textContent = "Order saved";
  } catch (e) {
    status.textContent = (e as Error).message;
  }
}
app.ontoolresult = (result) => show(result.structuredContent);
app.connect().catch(() => {
  status.textContent = "Open this view in a client that supports MCP Apps.";
});
