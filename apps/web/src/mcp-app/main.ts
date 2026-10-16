import { wuffCopy, wuffError } from "../lib/copy";
import { App } from "@modelcontextprotocol/ext-apps";
import { renderTaskMarkdown } from "../lib/task-markdown";
import type { Task } from "@wuff/contracts";
import type { ListOrder, ListSummary, TodoList } from "@wuff/contracts";
import { taskImageLimit, taskImagePath, listColors } from "@wuff/contracts";
import { listPalette } from "../lib/list-colors";
const app = new App({ name: "Wuff Todo", version: "0.2.0" }, {});
let current: TodoList | undefined,
  viewerId = "",
  catalog: ListSummary[] = [],
  archive = false;
const root = document.querySelector<HTMLElement>("#app")!;
const status = document.querySelector<HTMLElement>("#status")!;
class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
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
    if (e.isComposing) return;
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      submit();
    }
  };
}
function inlineName(
  value: string,
  label: string,
  tool: string,
  args: Record<string, unknown>,
  options: {
    heading?: "h1" | "h2";
    editable?: boolean;
    completed?: boolean;
  } = {},
) {
  const wrapper = element("div");
  wrapper.className = "inline-name";
  const nameKey = `${tool}:${args.taskId ?? args.sectionId ?? "list"}`;
  wrapper.dataset.nameKey = nameKey;
  const render = () => {
    const text = element("span", value);
    if (options.completed) text.style.textDecoration = "line-through";
    const trigger = button("", () => {
      const target = {
        listId: current!.id,
        version: current!.version,
        ...args,
      };
      const form = element("form");
      form.className = "name-editor";
      form.setAttribute("aria-label", `Edit ${label.toLowerCase()}`);
      const input = element("input");
      input.value = value;
      input.maxLength = 300;
      input.required = true;
      input.setAttribute("aria-label", label);
      input.autocomplete = "off";
      const save = element("button", "Save"),
        cancel = button("Cancel", () => {
          if (!save.disabled) {
            render();
            wrapper.querySelector<HTMLButtonElement>(".name-button")?.focus();
          }
        }),
        notice = element("p");
      notice.setAttribute("role", "alert");
      const caption = element("label", label);
      const fieldId = `name-${crypto.randomUUID()}`;
      input.id = fieldId;
      caption.htmlFor = fieldId;
      const actions = element("div");
      actions.className = "name-actions";
      actions.append(save, cancel);
      form.append(caption, input, actions, notice);
      let savedTitle = "",
        operationId = crypto.randomUUID();
      wireForm(form, save, () => {
        const title = input.value.trim();
        if (!title) {
          notice.textContent = "Give it a name to bark about first.";
          save.disabled = false;
          input.focus();
          return;
        }
        if (title === value) {
          render();
          wrapper.querySelector<HTMLButtonElement>(".name-button")?.focus();
          return;
        }
        if (savedTitle && savedTitle !== title)
          operationId = crypto.randomUUID();
        savedTitle = title;
        cancel.disabled = true;
        input.readOnly = true;
        notice.textContent = "";
        status.textContent = wuffCopy.saving;
        void request(tool, { ...target, title, operationId })
          .then((data) => {
            show(data);
            status.textContent = wuffCopy.saved;
            Array.from(root.querySelectorAll<HTMLElement>(".inline-name"))
              .find((el) => el.dataset.nameKey === nameKey)
              ?.querySelector<HTMLButtonElement>(".name-button")
              ?.focus();
          })
          .catch((e) => {
            notice.textContent = wuffError((e as Error).message);
            status.textContent =
              "Ruff patch! The name wasn’t saved. Your draft is kept.";
            save.disabled = false;
            cancel.disabled = false;
            input.readOnly = false;
          });
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !save.disabled) {
          e.preventDefault();
          e.stopPropagation();
          render();
          wrapper.querySelector<HTMLButtonElement>(".name-button")?.focus();
        }
      });
      wrapper.replaceChildren(form);
      input.focus();
      input.select();
    });
    trigger.className = "name-button";
    trigger.title = `Edit ${label.toLowerCase()}`;
    trigger.append(text);
    const mark = element("span", "✎");
    mark.className = "name-mark";
    mark.setAttribute("aria-hidden", "true");
    trigger.append(mark);
    const content = options.editable ? trigger : text;
    if (options.heading) {
      const heading = element(options.heading);
      heading.append(content);
      wrapper.replaceChildren(heading);
    } else wrapper.replaceChildren(content);
  };
  render();
  return wrapper;
}

const imageReads = new Map<string, Promise<string>>();
let imageEpoch = 0;
function renderNotes(target: HTMLElement, content: string) {
  target.innerHTML = renderTaskMarkdown(content, { imageSource: () => null });
}
async function hydrateImages(target: HTMLElement) {
  const epoch = imageEpoch;
  for (const placeholder of target.querySelectorAll<HTMLElement>(
    "[data-task-image]",
  )) {
    const id = placeholder.dataset.taskImage!;
    try {
      let read = imageReads.get(id);
      if (!read) {
        read = app
          .callServerTool({
            name: "get_task_image",
            arguments: { attachmentId: id },
          })
          .then((result) => {
            const image = result.content?.find((item) => item.type === "image");
            if (
              result.isError ||
              !image ||
              image.type !== "image" ||
              image.mimeType !== "image/webp" ||
              image.data.length > 4 * Math.ceil(taskImageLimit / 3) ||
              !/^[A-Za-z0-9+/=]+$/.test(image.data)
            )
              throw new Error("Image unavailable");
            return `data:image/webp;base64,${image.data}`;
          });
        imageReads.set(id, read);
      }
      const src = await read;
      if (epoch !== imageEpoch || !placeholder.isConnected) continue;
      const image = element("img");
      image.src = src;
      image.alt = placeholder.getAttribute("aria-label") || "Task image";
      placeholder.replaceWith(image);
    } catch {
      if (placeholder.isConnected)
        placeholder.textContent =
          "Ruff patch! Image unavailable. Reopen this list to try again.";
    }
  }
}
type NoteDraft = {
  listId: string;
  original: string;
  content: string;
  operationId?: string;
  request?: Record<string, unknown>;
};
const noteDrafts = new Map<string, NoteDraft>();
function taskNotes(task: Task) {
  const panel = element("details"),
    summary = element("summary", task.content ? "Task notes" : "Add notes");
  panel.className = "task-notes";
  summary.setAttribute(
    "aria-label",
    `${task.content ? "Task notes" : "Add notes"} for ${task.title}`,
  );
  panel.append(summary);
  const preview = element("div");
  preview.className = "task-prose";
  renderNotes(preview, task.content);
  panel.ontoggle = () => {
    if (panel.open) void hydrateImages(panel);
  };
  const start = () => {
    const listId = current!.id;
    const draft = noteDrafts.get(task.id) ?? {
      listId,
      original: task.content,
      content: task.content,
    };
    noteDrafts.set(task.id, draft);
    const form = element("div"),
      input = element("textarea"),
      notice = element("p"),
      livePreview = element("div"),
      actions = element("div");
    form.className = "note-editor";
    livePreview.className = "task-prose";
    notice.setAttribute("role", "status");
    input.rows = 9;
    input.value = draft.content;
    input.setAttribute("aria-label", `Markdown notes for ${task.title}`);
    const renderPreview = () => {
      renderNotes(livePreview, input.value);
      if (panel.open) void hydrateImages(livePreview);
    };
    renderPreview();
    input.oninput = () => {
      draft.content = input.value;
      renderPreview();
    };
    const save = button(
        task.content !== draft.original ? "Save my notes" : "Save notes",
        () => {
          if (input.value.length > 16000) {
            notice.textContent =
              "That’s a long tail! Keep notes to 16,000 characters or fewer.";
            return;
          }
          // An uncertain response must retry the identical version and operation ID.
          const payload = {
            listId,
            version: current!.version,
            taskId: task.id,
            content: input.value,
          };
          if (draft.request && draft.request.content !== payload.content) {
            notice.textContent =
              "Paws a moment: retry the original notes or reopen the list to check the saved version before changing this draft.";
            return;
          }
          draft.request ??= { ...payload, operationId: crypto.randomUUID() };
          save.disabled = true;
          input.readOnly = true;
          cancel.disabled = true;
          status.textContent = "Saving your de-tails…";
          void request("update_task", draft.request)
            .then((result) => {
              noteDrafts.delete(task.id);
              show(result);
              status.textContent = "Paw-some, notes saved.";
            })
            .catch((error: Error) => {
              if (
                error instanceof ToolError &&
                error.code !== "internal_error"
              ) {
                draft.request = undefined;
                void request("show_list", { listId })
                  .then(show)
                  .catch(() => {});
              }
              notice.textContent = `${wuffError(error.message)} Your draft is kept. Reopen this list to compare the latest notes.`;
              status.textContent = "Ruff patch! Notes weren’t confirmed saved.";
              save.disabled = false;
              input.readOnly = false;
              cancel.disabled = false;
            });
        },
      ),
      cancel = button("Cancel", () => {
        noteDrafts.delete(task.id);
        render();
      });
    const uploadInput = element("input");
    uploadInput.type = "file";
    uploadInput.accept = "image/png,image/jpeg,image/webp";
    uploadInput.setAttribute("aria-label", `Add image to ${task.title}`);
    // A bridge retry of the same bytes keeps the operation UUID and version.
    let uploadRetry:
      { digest: string; input: Record<string, unknown> } | undefined;
    uploadInput.onchange = () => {
      const file = uploadInput.files?.[0];
      uploadInput.value = "";
      if (!file) return;
      if (file.size > taskImageLimit) {
        notice.textContent = "That’s a big pup! Choose an image up to 3 MiB.";
        return;
      }
      const epoch = imageEpoch;
      uploadInput.disabled =
        save.disabled =
        cancel.disabled =
        input.readOnly =
          true;
      notice.textContent = wuffCopy.uploadingImage;
      void (async () => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192)
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 8192),
          );
        const digest = btoa(binary);
        if (!uploadRetry || uploadRetry.digest !== digest)
          uploadRetry = {
            digest,
            input: {
              listId,
              taskId: task.id,
              version: current!.version,
              operationId: crypto.randomUUID(),
              imageBase64: digest,
            },
          };
        const value = (await request(
          "upload_task_image",
          uploadRetry.input,
        )) as { image: { id: string } };
        if (epoch !== imageEpoch || !input.isConnected) return;
        input.setRangeText(
          `\n\n![Task image](${taskImagePath(value.image.id)})\n\n`,
          input.selectionStart,
          input.selectionEnd,
          "end",
        );
        draft.content = input.value;
        renderPreview();
        uploadRetry = undefined;
        notice.textContent =
          "Photo fetched! Save notes to keep it with your pack.";
      })()
        .catch((error) => {
          notice.textContent =
            error instanceof Error
              ? wuffError(error.message)
              : "Ruff patch! Image upload failed.";
          if (error instanceof ToolError && error.code !== "internal_error")
            uploadRetry = undefined;
        })
        .finally(() => {
          uploadInput.disabled =
            save.disabled =
            cancel.disabled =
            input.readOnly =
              false;
        });
    };
    if (!current!.archived) form.append(uploadInput);
    actions.className = "name-actions";
    actions.append(save, cancel);
    if (task.content !== draft.original)
      notice.textContent =
        "New de-tails arrived. Compare the latest saved notes below before saving your version.";
    form.append(
      element("p", "A little more de-tail · Markdown"),
      input,
      element("p", "Preview"),
      livePreview,
      notice,
    );
    if (task.content !== draft.original) form.append(preview);
    if (!current!.archived) form.append(actions);
    else {
      input.readOnly = true;
      form.append(
        element(
          "p",
          "This list is taking a paws. Its owner must restore it before you can save.",
        ),
      );
    }
    panel.replaceChildren(summary, form);
    panel.open = true;
    input.focus();
  };
  const render = () => {
    panel.replaceChildren(summary, preview);
    if (!task.content)
      panel.append(
        element("p", "More de-tails? Add a note or a link for your pack."),
      );
    if (!current!.archived)
      panel.append(button(task.content ? "Edit notes" : "Add notes", start));
  };
  render();
  if (noteDrafts.has(task.id)) start();
  return panel;
}

function show(value: unknown) {
  if (!value || typeof value !== "object") return;
  const data = value as {
    list?: TodoList;
    lists?: ListSummary[];
    viewerId?: string;
  };
  // A host may forward an error or a tool result for another view. Keep the
  // current notes/drafts on screen instead of clearing them.
  if (!data.list && !data.lists) return;
  if (data.viewerId && viewerId && data.viewerId !== viewerId)
    noteDrafts.clear();
  if (data.viewerId) viewerId = data.viewerId;
  imageReads.clear();
  imageEpoch++;
  root.replaceChildren();
  if (data.lists) {
    catalog = data.lists;
    current = undefined;
    renderCatalog();
    return;
  }
  if (!data.list) return;
  current = data.list;
  for (const [id, draft] of noteDrafts)
    if (draft.listId === current.id && !current.tasks.some((t) => t.id === id))
      noteDrafts.delete(id);
  const color = listPalette[current.color];
  root.append(button("← Your lists", () => void call("show_lists", {})));
  const header = element("div");
  header.className = "list-header";
  header.style.background = color.tint;
  header.style.borderColor = color.accent;
  const owner = current.ownerId === viewerId;
  header.append(
    inlineName(
      current.title,
      "List name",
      "update_list",
      {},
      { heading: "h1", editable: owner },
    ),
  );
  if (current.description) {
    const p = element("p", current.description);
    p.style.whiteSpace = "pre-wrap";
    header.append(p);
  }
  if (current.archived)
    header.append(
      element(
        "p",
        "Taking a paws · restore this archived list before editing tasks.",
      ),
    );
  root.append(header);
  if (owner) {
    const settings = element("details"),
      summary = element("summary", "List settings");
    settings.append(summary);
    const form = element("form");
    form.className = "settings";
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
    form.append(description, select, save);
    wireForm(form, save, () => {
      void mutation("update_list", {
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
    root.append(
      inlineName(
        group.title,
        "Section name",
        "rename_section",
        { sectionId: group.id },
        { heading: "h2", editable: owner && !!group.id && !current.archived },
      ),
    );
    details.append(
      element(
        "summary",
        `Tasks (${current.tasks.filter((t) => t.sectionId === group.id && !t.completed).length})`,
      ),
    );
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
      row.append(
        check,
        inlineName(
          task.title,
          "Task name",
          "update_task",
          { taskId: task.id },
          { editable: !current.archived, completed: task.completed },
        ),
      );
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
      details.append(row, taskNotes(task));
    }
    if (!current.archived) {
      const form = element("form"),
        input = element("input"),
        save = element("button", "Add");
      input.required = true;
      input.maxLength = 300;
      input.placeholder = "What’s next for your pack?";
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
      actions.append(
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
    input.placeholder = wuffCopy.sectionPlaceholder;
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
    element("h1", archive ? wuffCopy.archiveHeading : wuffCopy.listsHeading),
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
          ? "No lists taking a paws yet."
          : "Start your pack: create your first list on Wuff, or ask your AI assistant to create one.",
      ),
    );
}
async function reorder(id: string, target: string) {
  status.textContent = wuffCopy.saving;
  try {
    const data = (await request("get_list_order", {})) as { order: ListOrder };
    const ids = [...data.order.listIds],
      a = ids.indexOf(id),
      b = ids.indexOf(target);
    if (a < 0 || b < 0)
      throw new Error(
        "Your pack of lists changed. Reopen the list view and try again.",
      );
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await request("reorder_lists", {
      listIds: ids,
      version: data.order.version,
      operationId: crypto.randomUUID(),
    });
    show(await request("show_lists", {}));
    status.textContent = "Paw-some, order saved";
  } catch (e) {
    status.textContent = wuffError((e as Error).message);
  }
}
app.ontoolresult = (result) => show(result.structuredContent);
app.connect().catch(() => {
  status.textContent =
    "This view needs a helping paw. Open it in a client that supports MCP Apps.";
});
