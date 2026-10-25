import {
  totakeEngine as te,
  type TotakeSnapshot,
  type TotakeAction,
  type TotakeMutation,
} from "@wuff/contracts";
import {
  calendarDay,
  dueDatePresentation,
  formatDueDate,
} from "../lib/due-date";
import {
  defaultDashboardSettings,
  empireAppPreference,
  type EmpireSettings,
  type EmpireSettingsUpdate,
  type Dashboard,
  type DashboardSettings,
  sidebarGroups,
  defaultListView,
  starterViews,
  viewSettings,
  listViewSchema,
  viewColumns,
  projectListView,
  statusLabels,
  viewSorts,
  type ListView,
  dueDateSchema,
  taskStatuses,
  taskPriorities,
  taskReferencesSchema,
} from "@wuff/contracts";
import { taskMetadata } from "../lib/task-metadata";
import { wuffCopy, wuffError } from "../lib/copy";
import { App } from "@modelcontextprotocol/ext-apps";
import { renderTaskMarkdown } from "../lib/task-markdown";
import type { PersonalReminder } from "@wuff/contracts";
import type { Task } from "@wuff/contracts";
import type { ListOrder, ListSummary, TodoList } from "@wuff/contracts";
import { taskImageLimit, taskImagePath, listColors } from "@wuff/contracts";
import { applyListTheme } from "../lib/list-theme";
import { listPalette } from "../lib/list-colors";
const app = new App({ name: "Wuff Empire", version: "0.3.0" }, {});
const githubExpanded = new Set<string>();
let current: TodoList | undefined,
  webOrigin = "https://wuff-todo.vercel.app",
  viewerId = "",
  catalog: ListSummary[] = [],
  archive = false;
const root = document.querySelector<HTMLElement>("#app")!;
const viewEditorCleanups = new Set<() => void>();
function clearViewEditors() {
  for (const cleanup of viewEditorCleanups) cleanup();
  viewEditorCleanups.clear();
}
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
  if (tag === "button") {
    e.className = "wuff-button";
    e.dataset.variant = "default";
  }
  return e;
}
function button(text: string, run: () => void, disabled = false) {
  const e = element("button", text);
  e.type = "button";
  e.disabled = disabled;
  e.onclick = run;
  if (/^Save (my )?notes$/.test(text)) e.dataset.variant = "primary";
  if (/^(Delete|Remove|Disconnect)/.test(text)) e.dataset.variant = "danger";
  if (/^Delete task/.test(text)) e.dataset.variant = "destructive";
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
let fieldSequence = 0;
function wireForm(
  form: HTMLFormElement,
  save: HTMLButtonElement,
  run: () => void,
) {
  save.dataset.variant = "primary";
  for (const control of form.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input:not([type=hidden]),textarea,select")) {
    const name = control.getAttribute("aria-label");
    if (!name || control.labels?.length || control.closest("label")) continue;
    control.id ||= `wuff-field-${++fieldSequence}`;
    const label = element("label", name);
    label.htmlFor = control.id;
    label.className = "field-label";
    control.before(label);
  }
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
            if (args.taskId) {
              root
                .querySelector<HTMLButtonElement>(
                  `[data-task-id="${CSS.escape(String(args.taskId))}"] .task-title`,
                )
                ?.focus();
              return;
            }
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

type DateDraft = {
  version: number;
  value: string;
  base: string | null;
  request?: Record<string, unknown>;
  error?: string;
};
const dateDrafts = new Map<string, DateDraft>();
const cueRenderers = new Map<string, () => void>();
let cueDay = calendarDay();
function refreshDueBadges() {
  const nextDay = calendarDay();
  if (cueDay !== nextDay) {
    cueDay = nextDay;
    for (const render of cueRenderers.values()) render();
  }
  for (const badge of root.querySelectorAll<HTMLElement>("[data-due-date]")) {
    const display = dueDatePresentation(
      badge.dataset.dueDate!,
      badge.dataset.completed === "true",
      calendarDay(),
    );
    badge.textContent = display.label;
    badge.title = display.detail;
    badge.setAttribute("aria-label", display.detail);
    badge.className = "status-tag";
    badge.dataset.tone =
      display.tone === "overdue"
        ? "danger"
        : display.tone === "today"
          ? "active"
          : "neutral";
  }
}
function taskDueDate(task: Task) {
  const panel = element("details"),
    summary = element("summary", "Due date");
  panel.className = "task-notes";
  panel.setAttribute("aria-label", `Due date for ${task.title}`);
  const draft = dateDrafts.get(task.id) ?? {
    value: task.dueDate ?? "",
    base: task.dueDate ?? null,
    version: current!.version,
  };
  if (
    !draft.request &&
    draft.value === (draft.base ?? "") &&
    draft.version !== current!.version
  ) {
    draft.base = task.dueDate ?? null;
    draft.value = task.dueDate ?? "";
    draft.version = current!.version;
  }
  const stale =
    draft.value !== (draft.base ?? "") && draft.version !== current!.version;
  panel.open = dateDrafts.has(task.id);
  panel.ontoggle = () => {
    if (panel.open && !dateDrafts.has(task.id)) dateDrafts.set(task.id, draft);
  };
  panel.append(summary);
  if (current!.archived) {
    panel.append(
      element(
        "p",
        "This list is taking a paws. Restore it before changing dates.",
      ),
    );
    return panel;
  }
  const form = element("form"),
    input = element("input"),
    save = element(
      "button",
      draft.request ? "Retry same request" : "Save date",
    ),
    notice = element("p");
  form.style.cssText = "display:flex;flex-wrap:wrap";
  notice.setAttribute("role", "alert");
  notice.textContent = draft.error ?? "";
  input.type = "date";
  input.min = "0001-01-01";
  input.max = "9999-12-31";
  input.value = draft.value;
  input.setAttribute("aria-label", `Choose due date for ${task.title}`);
  input.readOnly = !!draft.request;
  input.oninput = () => {
    draft.value = input.value;
    dateDrafts.set(task.id, draft);
  };
  const controls: HTMLButtonElement[] = [];
  const pick = (value: string) => {
    draft.value = value;
    input.value = value;
    dateDrafts.set(task.id, draft);
    notice.textContent = "";
  };
  const commit = (dueDate: string | null) => {
    if (!draft.request && stale) {
      notice.textContent =
        "The list changed. Your date draft is kept. Load latest date before saving.";
      return;
    }
    if (dueDate !== null && !dueDateSchema.safeParse(dueDate).success) {
      notice.textContent = "Choose a valid calendar date.";
      save.disabled = false;
      return;
    }
    if (draft.request && draft.request.dueDate !== dueDate) {
      notice.textContent =
        "Paws a moment! Retry the original date to confirm it before choosing another.";
      save.disabled = false;
      return;
    }
    draft.value = dueDate ?? "";
    input.value = draft.value;
    draft.request ??= {
      listId: current!.id,
      version: draft.version,
      taskId: task.id,
      dueDate,
      operationId: crypto.randomUUID(),
    };
    dateDrafts.set(task.id, draft);
    input.readOnly = true;
    controls.forEach((b) => (b.disabled = true));
    save.disabled = true;
    status.textContent = wuffCopy.saving;
    void request("update_task", draft.request)
      .then((value) => {
        dateDrafts.delete(task.id);
        show(value);
        status.textContent = dueDate
          ? "Paw-some, due date saved."
          : "Date cleared. A little more room to roam.";
      })
      .catch((error: Error) => {
        draft.error = wuffError(error.message) + " Your date pick is kept.";
        notice.textContent = draft.error;
        status.textContent = draft.error;
        if (error instanceof ToolError && error.code !== "internal_error") {
          const listId = String(draft.request!.listId);
          draft.request = undefined;
          input.readOnly = false;
          controls.forEach((b) => (b.disabled = false));
          void request("show_list", { listId })
            .then(show)
            .catch(() => {});
        }
        save.textContent = draft.request ? "Retry same request" : "Save date";
        save.disabled = false;
      });
  };
  const quick = element("div");
  quick.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
  for (const [label, offset] of [
    ["Today", 0],
    ["Tomorrow", 1],
  ] as const) {
    const b = button(label, () => pick(calendarDay(offset)), !!draft.request);
    controls.push(b);
    quick.append(b);
  }
  panel.append(
    element(
      "p",
      "Choose a date or shortcut, then Save date. Clear date also waits for Save.",
    ),
    quick,
  );
  if (stale && !draft.request) {
    save.disabled = true;
    panel.append(
      element(
        "p",
        "The list changed. Your date draft is kept. Load latest date before saving.",
      ),
      button("Load latest date", () => {
        draft.value = task.dueDate ?? "";
        draft.base = task.dueDate ?? null;
        draft.version = current!.version;
        draft.error = undefined;
        dateDrafts.set(task.id, draft);
        show({ list: current });
      }),
    );
  }
  form.append(input, save);
  wireForm(form, save, () =>
    commit(
      draft.request
        ? (draft.request.dueDate as string | null)
        : input.value || null,
    ),
  );
  panel.append(form);
  if (task.dueDate) {
    const clear = button("Clear date", () => pick(""), !!draft.request);
    controls.push(clear);
    panel.append(clear);
  }
  const cancel = button(
    "Cancel",
    () => {
      draft.value = task.dueDate ?? "";
      draft.base = task.dueDate ?? null;
      draft.version = current!.version;
      input.value = draft.value;
      dateDrafts.delete(task.id);
      panel.open = false;
    },
    !!draft.request,
  );
  controls.push(cancel);
  panel.append(cancel, notice);
  return panel;
}

type SubtaskDraft = { title: string; request?: Record<string, unknown> };
const subtaskDrafts = new Map<string, SubtaskDraft>();
const subtaskExpanded = new Map<string, boolean>();
let draggedSubtask:
  { id: string; parentId: string; version: number } | undefined;
type WorkDraft = {
  status: Task["status"];
  priority: Task["priority"];
  assigneeId: string | null;
  references: Task["references"];
  version: number;
  request?: Record<string, unknown>;
};
const workDrafts = new Map<string, WorkDraft>();
const taskExpanded = new Map<string, boolean>();
function workDetails(task: Task) {
  const panel = element("details");
  const retained = workDrafts.get(task.id);
  panel.open = !!retained;
  panel.append(element("summary", `${task.key} · Work details`));
  const form = element("form");
  form.style.cssText = "display:grid;gap:10px;margin-block:12px";
  const draft: WorkDraft = retained ?? {
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    references: task.references.map((r) => ({ ...r })),
    version: current!.version,
  };
  const controls: (HTMLInputElement | HTMLSelectElement | HTMLButtonElement)[] =
    [];
  function selectField(
    label: string,
    values: { value: string; label: string }[],
    initial: string,
    changed: (value: string) => void,
  ) {
    const labelElement = element("label", label),
      select = element("select");
    select.setAttribute("aria-label", label);
    for (const value of values) {
      const option = element("option", value.label);
      option.value = value.value;
      select.append(option);
    }
    select.value = initial;
    select.onchange = () => {
      changed(select.value);
      workDrafts.set(task.id, draft);
    };
    controls.push(select);
    labelElement.append(select);
    form.append(labelElement);
  }
  selectField(
    "Status",
    taskStatuses.map((value) => ({ value, label: value.replaceAll("_", " ") })),
    draft.status,
    (value) => {
      draft.status = value as Task["status"];
    },
  );
  selectField(
    "Priority",
    taskPriorities.map((value) => ({ value, label: value })),
    draft.priority,
    (value) => {
      draft.priority = value as Task["priority"];
    },
  );
  if (current!.assignees.length)
    selectField(
      "Assignee",
      [
        { value: "", label: "Unassigned" },
        ...current!.assignees.map((p) => ({ value: p.id, label: p.name })),
      ],
      draft.assigneeId ?? "",
      (value) => {
        draft.assigneeId = value || null;
      },
    );
  else form.append(element("p", "Share this list to assign tasks."));
  const references = element("div");
  const renderReferences = () => {
    references.replaceChildren();
    draft.references.forEach((ref, i) => {
      const row = element("div");
      row.style.cssText = "display:grid;gap:6px;margin-block:8px";
      for (const field of ["title", "url"] as const) {
        const label = element(
            "label",
            field === "url" ? "Reference URL" : "Reference title",
          ),
          input = element("input");
        input.value = ref[field] ?? "";
        input.type = field === "url" ? "url" : "text";
        input.required = field === "url";
        input.maxLength = field === "url" ? 2048 : 200;
        input.oninput = () => {
          ref[field] = input.value;
          workDrafts.set(task.id, draft);
        };
        controls.push(input);
        label.append(input);
        row.append(label);
      }
      const remove = button("Remove reference", () => {
        draft.references.splice(i, 1);
        workDrafts.set(task.id, draft);
        renderReferences();
      });
      controls.push(remove);
      row.append(remove);
      references.append(row);
    });
    const add = button(
      "Add reference",
      () => {
        draft.references.push({ url: "", title: "" });
        workDrafts.set(task.id, draft);
        renderReferences();
      },
      draft.references.length >= 20,
    );
    controls.push(add);
    references.append(add);
  };
  renderReferences();
  form.append(references);
  const notice = element("p");
  notice.setAttribute("role", "status");
  if (draft.version !== current!.version)
    notice.textContent =
      "The list changed. Your work draft is kept. Use latest to reload these fields.";
  const latest = button("Use latest work details", () => {
    workDrafts.delete(task.id);
    void request("show_list", { listId: current!.id })
      .then(show)
      .catch((e) => {
        notice.textContent = (e as Error).message;
      });
  });
  const save = element("button", "Save work details");
  controls.push(save, latest);
  const lock = (locked: boolean) =>
    controls.forEach((c) => {
      c.disabled = locked || current!.archived;
    });
  wireForm(form, save, () => {
    const parsed = taskReferencesSchema.safeParse(draft.references);
    if (!parsed.success) {
      notice.textContent = parsed.error.issues.map((i) => i.message).join("; ");
      save.disabled = false;
      return;
    }
    draft.request ??= {
      listId: current!.id,
      taskId: task.id,
      version: draft.version,
      status: draft.status,
      priority: draft.priority,
      assigneeId: draft.assigneeId,
      references: parsed.data,
      operationId: crypto.randomUUID(),
    };
    workDrafts.set(task.id, draft);
    lock(true);
    void request("update_task", draft.request)
      .then((data) => {
        workDrafts.delete(task.id);
        show(data);
        status.textContent = wuffCopy.saved;
      })
      .catch((e) => {
        notice.textContent = `${(e as Error).message} Your draft is kept.`;
        if (e instanceof ToolError && e.code !== "internal_error")
          draft.request = undefined;
        lock(!!draft.request);
        save.disabled = current!.archived;
        if (!draft.request)
          void request("show_list", { listId: current!.id })
            .then(show)
            .catch(() => {});
      });
  });
  if (draft.version !== current!.version) form.append(latest);
  form.append(save, notice);
  panel.append(form);
  lock(!!draft.request);
  if (draft.request) save.disabled = current!.archived;
  return panel;
}

function personalTaskReminder(task: Task) {
  const panel = element("details"),
    body = element("div");
  panel.append(element("summary", "Remind me"), body);
  body.className = "settings";
  const listId = current!.id;
  let loaded = false,
    reminder: PersonalReminder | null = null,
    pending: Record<string, unknown> | undefined;
  const notice = element("p");
  notice.setAttribute("role", "status");
  const input = element("input");
  input.type = "datetime-local";
  input.setAttribute("aria-label", `Reminder time for ${task.title}`);
  const save = button("Save my reminder", () => {
    if (!input.value || !input.reportValidity()) return;
    const instant = new Date(input.value);
    if (!Number.isFinite(instant.getTime())) return;
    void update(instant.toISOString());
  });
  const hour = button(
    "In one hour",
    () => void update(new Date(Date.now() + 3600000).toISOString()),
  );
  const remove = button("Remove my reminder", () => void update(null));
  const setup = element("a", "Notification devices & daily nudge");
  setup.href = new URL("/settings/reminders", webOrigin).href;
  setup.target = "_blank";
  setup.rel = "noreferrer";
  function display() {
    notice.textContent = reminder?.enabled
      ? `Your reminder: ${new Date(reminder.runAt).toLocaleString()}${reminder.scheduling === "pending" ? " · scheduling pending" : ""}`
      : "No active reminder.";
    remove.hidden = !reminder?.enabled;
  }
  async function load() {
    body.replaceChildren(element("p", "Loading your reminder…"));
    try {
      const result = (await request("get_task_reminder", {
        listId,
        taskId: task.id,
      })) as { reminder: PersonalReminder | null };
      reminder = result.reminder;
      loaded = true;
      body.replaceChildren(
        element(
          "p",
          `Personal reminder · date and time in ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Quiet hours apply.`,
        ),
        input,
        save,
        hour,
        remove,
        button("Load latest reminder", () => {
          pending = undefined;
          void load();
        }),
        setup,
        notice,
      );
      input.disabled =
        save.disabled =
        hour.disabled =
          task.completed || current!.archived;
      display();
    } catch (e) {
      body.replaceChildren(
        element("p", (e as Error).message),
        button("Retry", () => void load()),
      );
    }
  }
  async function update(runAt: string | null) {
    const next = {
      listId,
      taskId: task.id,
      version: reminder?.version ?? 0,
      runAt,
    };
    if (
      !pending ||
      JSON.stringify({ ...pending, operationId: undefined }) !==
        JSON.stringify(next)
    )
      pending = { ...next, operationId: crypto.randomUUID() };
    save.disabled = hour.disabled = remove.disabled = true;
    try {
      const result = (await request("set_task_reminder", pending)) as {
        reminder: PersonalReminder;
      };
      reminder = result.reminder;
      pending = undefined;
      display();
    } catch (e) {
      notice.textContent = (e as Error).message;
      if (e instanceof ToolError && e.code !== "internal_error")
        pending = undefined;
    } finally {
      save.disabled = hour.disabled = task.completed || current!.archived;
      remove.disabled = false;
    }
  }
  panel.ontoggle = () => {
    if (panel.open && !loaded) void load();
  };
  return panel;
}
function personalListReminder() {
  const panel = element("details"),
    body = element("div");
  panel.append(element("summary", "Reminders for me"), body);
  body.className = "settings";
  const listId = current!.id;
  let loaded = false,
    version = 0,
    pending: Record<string, unknown> | undefined;
  const check = element("input");
  check.type = "checkbox";
  const label = element("label", "Include this list in my daily nudge");
  label.prepend(check);
  const notice = element("p");
  notice.setAttribute("role", "status");
  const save = button("Save my list reminders", () => {
    const value = { listId, version, dailyIncluded: check.checked };
    if (
      !pending ||
      JSON.stringify({ ...pending, operationId: undefined }) !==
        JSON.stringify(value)
    )
      pending = { ...value, operationId: crypto.randomUUID() };
    save.disabled = true;
    void request("update_list_reminders", pending)
      .then((data) => {
        const result = data as { version: number; dailyIncluded: boolean };
        version = result.version;
        check.checked = result.dailyIncluded;
        pending = undefined;
        notice.textContent = "Your list preference is saved.";
      })
      .catch((e) => {
        notice.textContent = e.message;
        loaded = false;
        if (e instanceof ToolError && e.code !== "internal_error")
          pending = undefined;
      })
      .finally(() => {
        save.disabled = false;
      });
  });
  panel.ontoggle = () => {
    if (!panel.open || loaded) return;
    body.textContent = "Loading your preferences…";
    void request("get_list_reminders", { listId })
      .then((data) => {
        const result = data as { version: number; dailyIncluded: boolean };
        version = result.version;
        check.checked = result.dailyIncluded;
        loaded = true;
        body.replaceChildren(
          element(
            "p",
            "Just for you. Other members keep their own preferences.",
          ),
          label,
          save,
          notice,
        );
      })
      .catch((e) => {
        body.textContent = e.message;
      });
  };
  return panel;
}

function renderTask(
  task: Task,
  groups: { id: string | null; title: string }[],
) {
  const wrapper = element("div"),
    row = element("div");
  wrapper.className = "task-item";
  wrapper.dataset.taskId = task.id;
  const view = current!.personalView?.view ?? defaultListView();
  wrapper.dataset.density =
    view.layout === "detailed" ? "comfortable" : "compact";
  wrapper.dataset.completed = String(task.completed);
  const actions = element("details"),
    actionPanel = element("div");
  actions.className = "task-actions";
  const actionTrigger = element("summary", "⋯");
  actionTrigger.setAttribute("aria-label", `More actions for ${task.title}`);
  actionTrigger.title = "Task actions";
  actionPanel.className = "task-action-menu";
  actions.append(actionTrigger, actionPanel);
  actions.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      actions.open = false;
      actionTrigger.focus();
    }
  };
  row.className = "task";
  const check = element("button");
  check.type = "button";
  check.className = "task-check";
  check.setAttribute("role", "checkbox");
  check.setAttribute("aria-checked", String(task.completed));
  const circle = element("span", task.completed ? "✓" : "");
  circle.setAttribute("aria-hidden", "true");
  check.append(circle);
  check.disabled = current!.archived;
  check.setAttribute(
    "aria-label",
    `${task.completed ? "Reopen" : "Complete"} ${task.title}`,
  );
  check.onclick = () => {
    check.disabled = true;
    void mutation("update_task", {
      taskId: task.id,
      completed: !task.completed,
    });
  };
  const title = button(task.title, () => {
    secondary.open = !secondary.open;
  });
  title.className = "task-title";
  title.replaceChildren(element("span", task.title));
  title.setAttribute("aria-label", `Open task: ${task.title}`);
  const nameEditor = inlineName(
    task.title,
    "Task name",
    "update_task",
    { taskId: task.id },
    { editable: !current!.archived, completed: task.completed },
  );
  row.append(check, title, actions);
  if (!task.parentTaskId && current!.sections.length) {
    const select = element("select");
    select.setAttribute("aria-label", `Section for ${task.title}`);
    select.disabled = current!.archived;
    for (const group of groups) {
      const option = element("option", group.title);
      option.value = group.id ?? "";
      select.append(option);
    }
    select.value = task.sectionId ?? "";
    select.onchange = () =>
      void mutation("update_task", {
        taskId: task.id,
        sectionId: select.value || null,
      });
    const label = element("label", "Move to section");
    label.append(select);
    actionPanel.append(label);
  }
  const children = current!.tasks.filter((t) => t.parentTaskId === task.id);
  if (!current!.archived) {
    const remove = button("Delete task", () => {
      actions.open = false;
      const warning = element("div");
      warning.setAttribute("role", "alert");
      warning.append(
        element(
          "p",
          `Paws before deleting: this removes “${task.title}”${children.length ? ` and all ${children.length} subtasks` : ""} for everyone. This cannot be undone.`,
        ),
        button(
          children.length ? "Delete task and subtasks" : "Delete task",
          () => void mutation("delete_task", { taskId: task.id }),
        ),
        button("Cancel", () => {
          warning.remove();
          actionTrigger.focus();
        }),
      );
      wrapper.querySelector("[data-delete-confirmation]")?.remove();
      warning.dataset.deleteConfirmation = "true";
      wrapper.append(warning);
      warning.querySelector<HTMLButtonElement>("button")?.focus();
    });
    remove.setAttribute("aria-label", `Delete ${task.title}`);
    remove.title = "Delete task";
    actionPanel.append(remove);
  }
  wrapper.append(row);
  const cues = element("div");
  cues.className = "task-cues";
  const renderCues = () => {
    const budget = taskMetadata(
      task,
      current!,
      calendarDay(),
      view.layout === "detailed",
    );
    cues.replaceChildren();
    for (const cue of budget.visible) {
      let item: HTMLElement;
      if (cue.kind === "due") {
        const badge = element("time", cue.label);
        badge.dateTime = task.dueDate!;
        badge.dataset.dueDate = task.dueDate!;
        badge.dataset.completed = String(task.completed);
        item = badge;
      } else if (cue.kind === "github") {
        const link = element("a", cue.label);
        link.href = task.github!.url!;
        link.target = "_blank";
        link.rel = "noreferrer";
        item = link;
      } else if (["notes", "progress", "attention"].includes(cue.kind)) {
        item = button(cue.label, () => {
          openDetails(
            cue.kind === "notes"
              ? notesPanel
              : cue.kind === "attention"
                ? githubPanel
                : subtaskPanel,
          );
        });
        item.setAttribute(
          "aria-label",
          `${cue.kind === "attention" ? "GitHub sync: " : ""}${cue.label} for ${task.title}`,
        );
      } else item = element("span", cue.label);
      item.classList.add("task-cue");
      if (cue.urgent && cue.kind !== "due")
        item.classList.add("task-cue-attention");
      cues.append(item);
    }
    if (budget.hidden.length) {
      const more = button(`+${budget.hidden.length} more`, () => openDetails());
      more.className = "task-cue";
      more.title = budget.hidden.map((cue) => cue.label).join(" · ");
      more.setAttribute(
        "aria-label",
        `${budget.hidden.length} more details for ${task.title}`,
      );
      cues.append(more);
    }
    cues.hidden = !cues.childElementCount;
  };
  cueRenderers.set(task.id, renderCues);
  wrapper.append(cues);
  const secondary = element("details"),
    detailsBody = element("div");
  secondary.className = "task-details";
  secondary.id = `task-details-${task.id}`;
  title.setAttribute("aria-controls", secondary.id);
  secondary.setAttribute("aria-label", `Details for ${task.title}`);
  detailsBody.className = "task-details-body";
  const retained = (t: Task) =>
    noteDrafts.has(t.id) ||
    dateDrafts.has(t.id) ||
    workDrafts.has(t.id) ||
    subtaskDrafts.has(t.id);
  secondary.open =
    !!taskExpanded.get(task.id) || retained(task) || children.some(retained);
  title.setAttribute("aria-expanded", String(secondary.open));
  secondary.ontoggle = () => {
    taskExpanded.set(task.id, secondary.open);
    title.setAttribute("aria-expanded", String(secondary.open));
  };
  const detailSummary = element("summary", "Task details");
  secondary.append(detailSummary, detailsBody);
  const renamePanel = element("details");
  renamePanel.append(element("summary", "Rename task"), nameEditor);
  const notesPanel = taskNotes(task),
    datePanel = taskDueDate(task),
    reminderPanel = personalTaskReminder(task);
  const workPanel = current!.mode === "work" ? workDetails(task) : undefined;
  const githubPanel =
    current!.mode === "work"
      ? githubDetails(task, (link) => {
          task.github = link;
          renderCues();
          refreshDueBadges();
        })
      : undefined;
  let subtaskPanel: HTMLDetailsElement | undefined;
  if (!current!.archived) detailsBody.append(renamePanel);
  detailsBody.append(notesPanel, datePanel, reminderPanel);
  if (workPanel) detailsBody.append(workPanel);
  if (githubPanel) detailsBody.append(githubPanel);
  function openDetails(target?: HTMLDetailsElement) {
    actions.open = false;
    secondary.open = true;
    taskExpanded.set(task.id, true);
    title.setAttribute("aria-expanded", "true");
    if (target) target.open = true;
    requestAnimationFrame(() =>
      (target?.querySelector<HTMLElement>("summary") ?? title).focus(),
    );
  }
  const quick = (
    label: string,
    target?: HTMLDetailsElement,
    edit?: boolean,
  ) => {
    const action = button(label, () => {
      openDetails(target);
      if (edit) target?.querySelector<HTMLButtonElement>("button")?.click();
      if (edit)
        requestAnimationFrame(() =>
          target
            ?.querySelector<HTMLElement>('textarea,input:not([type="file"])')
            ?.focus(),
        );
    });
    actionPanel.prepend(action);
  };
  const fullPage = element("a", "Open full task page");
  fullPage.href = new URL(task.path, webOrigin).href;
  fullPage.target = "_blank";
  fullPage.rel = "noreferrer";
  actionPanel.prepend(fullPage);
  quick("Remind me", reminderPanel);
  if (workPanel) quick("Status, priority & assignment", workPanel);
  quick(
    current!.archived
      ? "Due date"
      : task.dueDate
        ? "Change due date"
        : "Set due date",
    datePanel,
  );
  quick(
    task.content || current!.archived ? "Notes" : "Add notes",
    notesPanel,
    !task.content && !current!.archived,
  );
  if (!current!.archived) quick("Rename task", renamePanel, true);
  renderCues();
  wrapper.append(secondary);
  queueMicrotask(refreshDueBadges);
  if (task.parentTaskId) {
    if (
      !current!.archived &&
      (view.groupBy === "section"
        ? (view.sectionSorts.find(
            (s) =>
              s.sectionId ===
              current!.tasks.find((t) => t.id === task.parentTaskId)?.sectionId,
          )?.sortBy ?? view.sortBy)
        : view.sortBy) === "manual"
    ) {
      const parentId = task.parentTaskId;
      const siblings = current!.tasks.filter(
        (t) => t.parentTaskId === parentId,
      );
      const move = (from: number, to: number) => {
        if (from < 0 || to < 0 || to >= siblings.length || from === to) return;
        const taskIds = siblings.map((t) => t.id);
        const [id] = taskIds.splice(from, 1);
        taskIds.splice(to, 0, id);
        void mutation("reorder_tasks", {
          parentTaskId: parentId,
          taskIds,
        }).then(() =>
          root
            .querySelector<HTMLButtonElement>(
              `[data-subtask-handle="${task.id}"]`,
            )
            ?.focus(),
        );
      };
      const handle = button("Move", () => {
        const existing = wrapper.querySelector("[data-move-position]");
        if (existing) {
          existing.remove();
          return;
        }
        const label = element("label", "Move to position ");
        label.dataset.movePosition = "true";
        const picker = element("select");
        picker.setAttribute("aria-label", `Position for ${task.title}`);
        siblings.forEach((sibling, i) => {
          const option = element("option", `${i + 1} · ${sibling.title}`);
          option.value = String(i);
          picker.append(option);
        });
        const from = siblings.findIndex((s) => s.id === task.id);
        picker.value = String(from);
        picker.onchange = () => move(from, Number(picker.value));
        label.append(picker);
        wrapper.append(label);
        picker.focus();
      });
      handle.setAttribute("aria-label", `Reorder ${task.title}`);
      handle.title = "Lend a paw: drag to reorder, or use Alt+Arrow Up/Down";
      handle.dataset.subtaskHandle = task.id;
      handle.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
      handle.setAttribute(
        "aria-description",
        "Drag to reorder, or use Alt and Arrow Up or Down.",
      );
      handle.draggable = true;
      handle.ondragstart = (e) => {
        draggedSubtask = { id: task.id, parentId, version: current!.version };
        e.dataTransfer?.setData("application/x-wuff-subtask", task.id);
      };
      handle.ondragend = () => {
        draggedSubtask = undefined;
      };
      row.ondragover = (e) => {
        if (draggedSubtask?.parentId === parentId) e.preventDefault();
      };
      row.ondrop = (e) => {
        e.preventDefault();
        const dragged = draggedSubtask;
        draggedSubtask = undefined;
        if (
          dragged?.parentId === parentId &&
          dragged.version === current!.version
        )
          move(
            siblings.findIndex((t) => t.id === dragged.id),
            siblings.findIndex((t) => t.id === task.id),
          );
      };
      handle.onkeydown = (e) => {
        if (e.altKey && ["ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          const from = siblings.findIndex((t) => t.id === task.id);
          move(from, from + (e.key === "ArrowUp" ? -1 : 1));
        }
      };
      handle.classList.add("task-reorder");
      row.prepend(handle);
    }
    return wrapper;
  }
  if (children.length || !current!.archived) {
    const panel = element("details"),
      summary = element(
        "summary",
        `Little steps · ${children.filter((t) => t.completed).length} of ${children.length} done`,
      );
    subtaskPanel = panel;
    quick(children.length ? "Manage subtasks" : "Add subtask", panel);
    panel.setAttribute("aria-label", `Subtasks for ${task.title}`);
    panel.style.cssText =
      "border-left:2px solid var(--wuff-border);padding-left:14px;margin:8px 0 16px 16px";
    panel.open =
      subtaskExpanded.get(task.id) ??
      (subtaskDrafts.has(task.id) || children.some(retained));
    panel.ontoggle = () => subtaskExpanded.set(task.id, panel.open);
    panel.append(summary);
    for (const child of children) panel.append(renderTask(child, groups));
    if (!current!.archived) {
      const draft = subtaskDrafts.get(task.id) ?? { title: "" };
      const form = element("form"),
        input = element("input"),
        save = element("button", "Add subtask"),
        notice = element("p");
      notice.setAttribute("role", "alert");
      input.required = true;
      input.maxLength = 300;
      input.placeholder = "One little step for your pack…";
      input.setAttribute("aria-label", `New subtask for ${task.title}`);
      input.value = draft.title;
      input.readOnly = !!draft.request;
      if (draft.request) save.textContent = "Retry add subtask";
      input.oninput = () => {
        draft.title = input.value;
        subtaskDrafts.set(task.id, draft);
      };
      form.append(input, save);
      wireForm(form, save, () => {
        draft.request ??= {
          listId: current!.id,
          version: current!.version,
          parentTaskId: task.id,
          title: input.value,
          operationId: crypto.randomUUID(),
        };
        subtaskDrafts.set(task.id, draft);
        input.readOnly = true;
        status.textContent = wuffCopy.saving;
        void request("create_task", draft.request)
          .then((result) => {
            subtaskDrafts.delete(task.id);
            show(result);
            status.textContent = "Paw-some, little step added.";
          })
          .catch((error: Error) => {
            status.textContent = wuffError(error.message);
            notice.textContent =
              wuffError(error.message) +
              " Your little step is kept. Retry to confirm it was added.";
            if (error instanceof ToolError && error.code !== "internal_error") {
              draft.request = undefined;
              input.readOnly = false;
              void request("show_list", { listId: current!.id })
                .then(show)
                .catch(() => {});
            }
            save.disabled = false;
          });
      });
      panel.append(form, notice);
    }
    detailsBody.append(panel);
  }
  return wrapper;
}

function viewControls(list: TodoList) {
  const saved = list.personalView ?? { version: 0, view: defaultListView() };
  let draft = structuredClone(saved.view),
    pending: Record<string, unknown> | undefined;
  const toolbar = element("form"),
    line = element("div"),
    info = element("p"),
    notice = element("p"),
    save = element("button", "Save view");
  toolbar.className = "workspace-view-toolbar";
  line.className = "view-toolbar-line";
  notice.setAttribute("role", "alert");
  info.setAttribute("role", "status");
  const syncers: (() => void)[] = [];
  const presets = element("select");
  presets.setAttribute("aria-label", "Saved view");
  presets.className = "view-preset-picker";
  const starter = starterViews(viewerId, list.mode === "work");
  for (const p of [
    { id: "current", name: "Personal view" },
    ...starter,
    ...draft.presets,
  ]) {
    const o = element("option", p.name);
    o.value = p.id;
    presets.append(o);
  }
  presets.value = draft.activePresetId ?? "current";
  const changed = () => {
    info.textContent = "Unsaved view changes · Only changes your view";
    presets.disabled = true;
    save.disabled = false;
  };
  presets.onchange = () => {
    const p = [...starter, ...draft.presets].find(
      (p) => p.id === presets.value,
    );
    if (p) {
      draft = { ...draft, ...p.settings, activePresetId: p.id };
      syncers.forEach((fn) => fn());
      changed();
    }
  };
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search tasks…";
  search.setAttribute("aria-label", "Search title or key");
  search.maxLength = 300;
  search.value = draft.search;
  search.oninput = () => {
    draft.search = search.value;
    changed();
  };
  syncers.push(() => (search.value = draft.search));
  line.append(presets, search);
  function popover(label: string) {
    const trigger = button(label, () => {}),
      panel = element("div");
    panel.className = "view-popover";
    panel.id = `view-panel-${++fieldSequence}`;
    panel.setAttribute("popover", "auto");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", label);
    trigger.setAttribute("popovertarget", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    let controller: AbortController | undefined;
    let observer: ResizeObserver | undefined;
    viewEditorCleanups.add(() => {
      controller?.abort();
      observer?.disconnect();
      if (panel.matches(":popover-open")) panel.hidePopover();
    });
    panel.addEventListener("toggle", (e) => {
      const open = (e as ToggleEvent).newState === "open";
      trigger.setAttribute("aria-expanded", String(open));
      controller?.abort();
      observer?.disconnect();
      if (open) {
        const place = () => {
          const r = trigger.getBoundingClientRect();
          panel.style.maxHeight = `${Math.max(120, innerHeight - 24)}px`;
          panel.style.left = `${Math.max(12, Math.min(r.left, innerWidth - panel.offsetWidth - 12))}px`;
          panel.style.top = `${Math.max(12, Math.min(r.bottom + 6, innerHeight - panel.offsetHeight - 12))}px`;
        };
        place();
        observer = new ResizeObserver(place);
        observer.observe(panel);
        panel.querySelector<HTMLElement>("input,select,button")?.focus();
        controller = new AbortController();
        window.addEventListener("resize", place, { signal: controller.signal });
        window.addEventListener("scroll", place, {
          capture: true,
          signal: controller.signal,
        });
      }
    });
    line.append(trigger);
    toolbar.append(panel);
    return panel;
  }
  const filters = popover("Filter"),
    sort = popover("Sort"),
    group = popover("Group"),
    display = popover("Display"),
    manage = popover("Saved views");
  function select(
    target: HTMLElement,
    label: string,
    get: () => string,
    values: [string, string][],
    update: (v: string) => void,
  ) {
    const caption = element("label", label),
      input = element("select");
    input.setAttribute("aria-label", label);
    for (const [v, t] of values) {
      const o = element("option", t);
      o.value = v;
      input.append(o);
    }
    syncers.push(() => (input.value = get()));
    input.value = get();
    input.onchange = () => {
      update(input.value);
      changed();
    };
    caption.append(input);
    target.append(caption);
  }
  const options = (values: readonly string[]) =>
    values.map((v) => [v, v[0].toUpperCase() + v.slice(1)] as [string, string]);
  select(
    filters,
    "Section filter",
    () => draft.sections[0] ?? (draft.sections.length ? "none" : "all"),
    [
      ["all", "All sections"],
      ["none", "No section"],
      ...list.sections.map((s) => [s.id, s.title] as [string, string]),
    ],
    (v) => (draft.sections = v === "all" ? [] : [v === "none" ? null : v]),
  );
  if (list.mode === "work") {
    select(
      filters,
      "Status filter",
      () => draft.statuses[0] ?? "all",
      [
        ["all", "All statuses"],
        ...taskStatuses.map((s) => [s, statusLabels[s]] as [string, string]),
      ],
      (v) =>
        (draft.statuses =
          v === "all" ? [] : [v as ListView["statuses"][number]]),
    );
    select(
      filters,
      "Priority filter",
      () => draft.priorities[0] ?? "all",
      [["all", "All priorities"], ...options(taskPriorities)],
      (v) =>
        (draft.priorities =
          v === "all" ? [] : [v as ListView["priorities"][number]]),
    );
    select(
      filters,
      "Assignee filter",
      () => draft.assignees[0] ?? (draft.assignees.length ? "none" : "all"),
      [
        ["all", "Anyone"],
        ["none", "Unassigned"],
        ...list.assignees.map((a) => [a.id, a.name] as [string, string]),
      ],
      (v) => (draft.assignees = v === "all" ? [] : [v === "none" ? null : v]),
    );
  }
  select(
    filters,
    "Due date filter",
    () => draft.due,
    [
      ["all", "Any due date"],
      ["overdue", "Before today"],
      ["today", "Today"],
      ["upcoming", "After today"],
      ["no_date", "No due date"],
    ],
    (v) => (draft.due = v as ListView["due"]),
  );
  select(
    filters,
    "Completed tasks",
    () => draft.completed,
    [
      ["all", "Include completed"],
      ["hide", "Hide completed"],
      ["only", "Only completed"],
    ],
    (v) => (draft.completed = v as ListView["completed"]),
  );
  select(
    sort,
    "Sort by",
    () => draft.sortBy,
    [
      ["manual", "Manual"],
      ...(list.mode === "work"
        ? [["priority", "Priority"] as [string, string]]
        : []),
      ["due", "Due date"],
      ["updated", "Recently updated"],
    ],
    (v) => (draft.sortBy = v as ListView["sortBy"]),
  );
  const advanced = element("details");
  advanced.append(element("summary", "Sorting per section"));
  sort.append(advanced);
  for (const section of [{ id: null, title: "No section" }, ...list.sections])
    select(
      advanced,
      `Sort ${section.title}`,
      () =>
        draft.sectionSorts.find((s) => s.sectionId === section.id)?.sortBy ??
        "inherit",
      [["inherit", "Use list sorting"], ...options(viewSorts)],
      (v) =>
        (draft.sectionSorts = [
          ...draft.sectionSorts.filter((s) => s.sectionId !== section.id),
          ...(v === "inherit"
            ? []
            : [{ sectionId: section.id, sortBy: v as ListView["sortBy"] }]),
        ]),
    );
  select(
    group,
    "Group by",
    () => draft.groupBy,
    [
      ["section", "Section"],
      ...(list.mode === "work"
        ? [["status", "Status"] as [string, string]]
        : []),
      ["date", "Due date"],
    ],
    (v) => (draft.groupBy = v as ListView["groupBy"]),
  );
  select(
    display,
    "Row density",
    () => draft.layout,
    [
      ["compact", "Compact"],
      ["detailed", "Comfortable"],
    ],
    (v) => (draft.layout = v as ListView["layout"]),
  );
  if (list.mode === "work") {
    select(
      display,
      "Row layout",
      () => draft.rowStyle,
      [
        ["columns", "Columns"],
        ["list", "Simple rows"],
      ],
      (v) => (draft.rowStyle = v as ListView["rowStyle"]),
    );
    for (const column of viewColumns) {
      const caption = element(
          "label",
          column === "due"
            ? "Due date column"
            : `${column[0].toUpperCase() + column.slice(1)} column`,
        ),
        input = element("input");
      input.type = "checkbox";
      input.checked = draft.columns.includes(column);
      input.onchange = () => {
        draft.columns = viewColumns.filter((c) =>
          c === column ? input.checked : draft.columns.includes(c),
        );
        changed();
      };
      syncers.push(() => (input.checked = draft.columns.includes(column)));
      caption.prepend(input);
      display.append(caption);
    }
  }
  display.append(
    button("Reset to defaults", () => {
      draft = {
        ...draft,
        ...viewSettings(defaultListView()),
        activePresetId: "default",
      };
      syncers.forEach((fn) => fn());
      changed();
    }),
  );
  const presetName = element("input");
  presetName.setAttribute("aria-label", "View name");
  presetName.placeholder = "View name";
  presetName.maxLength = 60;
  const nameLabel = element("label", "View name");
  nameLabel.append(presetName);
  manage.append(nameLabel);
  const custom = () => draft.presets.find((p) => p.id === draft.activePresetId);
  function named(rename: boolean) {
    const name = presetName.value.trim();
    if (!name) {
      notice.textContent = "Enter a view name.";
      return;
    }
    const id = rename ? custom()?.id : crypto.randomUUID();
    if (!id) return;
    const next = {
      ...draft,
      presets: [
        ...draft.presets.filter((p) => p.id !== id),
        { id, name, settings: viewSettings(draft) },
      ],
      activePresetId: id,
    };
    const parsed = listViewSchema.safeParse(next);
    if (!parsed.success) {
      notice.textContent =
        parsed.error.issues[0]?.message ?? "Check the view name.";
      return;
    }
    draft = parsed.data;
    void persist();
  }
  manage.append(
    button("Save as new view", () => named(false), draft.presets.length >= 20),
    button("Rename saved view", () => named(true), !custom()),
  );
  manage.append(
    button(
      "Delete saved view",
      () => {
        const p = custom();
        if (!p) return;
        const confirmation = element("div");
        confirmation.append(
          element("p", `Delete “${p.name}”? Your tasks stay here.`),
          button("Confirm delete saved view", () => {
            draft = {
              ...draft,
              presets: draft.presets.filter((item) => item.id !== p.id),
              activePresetId: null,
            };
            void persist();
          }),
          button("Cancel", () => confirmation.remove()),
        );
        manage.append(confirmation);
      },
      !custom(),
    ),
  );
  for (const panel of [filters, sort, group, display, manage])
    panel.append(button("Done", () => panel.hidePopover()));
  const lock = (disabled: boolean) => {
    toolbar
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLButtonElement
      >("input,select,button")
      .forEach((control) => {
        if (control !== save && control.textContent !== "Done")
          control.disabled = disabled;
      });
  };
  async function persist() {
    const parsed = listViewSchema.safeParse(draft);
    if (!parsed.success) {
      notice.textContent =
        parsed.error.issues[0]?.message ?? "Check your view.";
      save.disabled = false;
      return;
    }
    pending ??= {
      listId: list.id,
      viewVersion: saved.version,
      view: parsed.data,
      operationId: crypto.randomUUID(),
    };
    lock(true);
    save.disabled = true;
    try {
      show(await request("update_list_view", pending));
      status.textContent = wuffCopy.saved;
    } catch (e) {
      notice.textContent = wuffError((e as Error).message);
      if (e instanceof ToolError && e.code !== "internal_error") {
        pending = undefined;
        lock(false);
        notice.append(
          button(
            "Reload saved view",
            () => void call("show_list", { listId: list.id }),
          ),
        );
      }
      save.textContent = pending ? "Retry same request" : "Save view";
      save.disabled = false;
    }
  }
  toolbar.prepend(line);
  toolbar.append(
    info,
    save,
    button(
      "Revert to saved view",
      () => void call("show_list", { listId: list.id }),
    ),
    notice,
  );
  wireForm(toolbar, save, () => {
    if (!pending && custom())
      draft = {
        ...draft,
        presets: draft.presets.map((p) =>
          p.id === custom()!.id ? { ...p, settings: viewSettings(draft) } : p,
        ),
      };
    void persist();
  });
  const keyHandler = toolbar.onkeydown;
  toolbar.onkeydown = (e) => {
    if (
      e.target instanceof HTMLButtonElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    keyHandler?.call(toolbar, e);
  };
  presetName.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      named(false);
    }
  };
  save.disabled = true;
  return toolbar;
}

function show(value: unknown) {
  if (!value || typeof value !== "object") return;
  const data = value as {
    totake?: TotakeSnapshot;
    totakeCanWrite?: boolean;
    empireSettings?: EmpireSettings;
    empireCanManage?: boolean;
    dashboard?: Dashboard;
    list?: TodoList;
    lists?: ListSummary[];
    viewerId?: string;
    webOrigin?: string;
  };
  // A host may forward an error or a tool result for another view. Keep the
  // current notes/drafts on screen instead of clearing them.
  if (
    !data.list &&
    !data.lists &&
    !data.dashboard &&
    !data.empireSettings &&
    !data.totake
  )
    return;
  if (data.viewerId && viewerId && data.viewerId !== viewerId) {
    pendingHome = null;
    noteDrafts.clear();
    subtaskDrafts.clear();
    dateDrafts.clear();
    subtaskExpanded.clear();
    workDrafts.clear();
    taskExpanded.clear();
    githubExpanded.clear();
  }
  if (data.viewerId) viewerId = data.viewerId;
  if (data.webOrigin) webOrigin = data.webOrigin;
  imageReads.clear();
  imageEpoch++;
  clearViewEditors();
  root.replaceChildren();
  root.classList.remove("totake-view");
  cueRenderers.clear();
  if (data.totake) {
    current = undefined;
    applyListTheme("blue", document.documentElement);
    renderTotake(data.totake, data.totakeCanWrite !== false);
    return;
  }
  if (data.empireSettings) {
    current = undefined;
    applyListTheme("blue", document.documentElement);
    renderEmpireSettings(data.empireSettings, data.empireCanManage !== false);
    return;
  }
  if (data.dashboard) {
    current = undefined;
    applyListTheme("blue", document.documentElement);
    renderDashboard(data.dashboard);
    return;
  }
  if (data.lists) {
    catalog = data.lists;
    current = undefined;
    applyListTheme("blue", document.documentElement);
    renderCatalog();
    return;
  }
  if (!data.list) return;
  current = data.list;
  applyListTheme(current.color, document.documentElement);
  for (const [id, draft] of noteDrafts)
    if (draft.listId === current.id && !current.tasks.some((t) => t.id === id))
      noteDrafts.delete(id);
  for (const id of subtaskDrafts.keys())
    if (!current.tasks.some((t) => t.id === id)) subtaskDrafts.delete(id);
  for (const id of dateDrafts.keys())
    if (!current.tasks.some((t) => t.id === id)) dateDrafts.delete(id);
  root.append(
    button("Home", () => void call("show_dashboard", { today: calendarDay() })),
    button("← Your lists", () => void call("show_lists", {})),
  );
  const header = element("div");
  header.className = "list-header";

  for (const id of taskExpanded.keys())
    if (!current.tasks.some((t) => t.id === id)) taskExpanded.delete(id);
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
    const mode = element("select");
    mode.setAttribute("aria-label", "List type");
    for (const value of ["simple", "work"]) {
      const option = element("option", value === "work" ? "Work" : "Simple");
      option.value = value;
      mode.append(option);
    }
    mode.value = current.mode;
    form.append(description, select, mode, save);
    wireForm(form, save, () => {
      void mutation("update_list", {
        description: description.value,
        color: select.value,
        mode: mode.value,
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
  root.append(personalListReminder());
  root.append(viewControls(current));
  const view = current.personalView?.view ?? defaultListView();
  const sections = [
    { id: null, title: current.sections.length ? "No section" : "Tasks" },
    ...current.sections,
  ];
  const groups = projectListView(current, view, calendarDay());
  root.append(
    element(
      "p",
      `${groups.reduce((n, g) => n + g.tasks.length, 0)} main tasks shown`,
    ),
  );
  for (const group of groups) {
    if (view.groupBy !== "section" && !group.tasks.length) continue;
    const details = element("details");
    details.className = "section";
    details.open = !view.collapsed.includes(group.id);
    const initialOpen = details.open;
    details.append(
      element("summary", `${group.title} (${group.tasks.length})`),
    );
    details.ontoggle = () => {
      const collapsed = details.open
        ? view.collapsed.filter((id) => id !== group.id)
        : [...new Set([...view.collapsed, group.id])].slice(-200);
      if (details.open === initialOpen) return;
      details.ontoggle = null;
      void request("update_list_view", {
        listId: current!.id,
        viewVersion: current!.personalView?.version ?? 0,
        view: { ...view, collapsed },
        operationId: crypto.randomUUID(),
      })
        .then(show)
        .catch((e) => {
          status.textContent = wuffError(e.message);
        });
    };
    if (owner && group.sectionId && !current.archived)
      details.append(
        inlineName(
          group.title,
          "Section name",
          "rename_section",
          { sectionId: group.sectionId },
          { heading: "h2" },
        ),
        button(
          `Remove ${group.title} (keep tasks)`,
          () => void mutation("delete_section", { sectionId: group.sectionId }),
        ),
      );
    if (owner && group.sectionId && !current.archived) {
      const sectionId = group.sectionId,
        index = current.sections.findIndex((s) => s.id === sectionId);
      for (const [direction, label] of [
        [-1, "up"],
        [1, "down"],
      ] as const)
        details.append(
          button(
            `Move ${group.title} ${label}`,
            () => {
              const ids = current!.sections.map((s) => s.id);
              [ids[index], ids[index + direction]] = [
                ids[index + direction],
                ids[index],
              ];
              void mutation("reorder_sections", { sectionIds: ids });
            },
            index + direction < 0 ||
              index + direction >= current.sections.length,
          ),
        );
    }
    for (const task of group.tasks) {
      if (group.childMatches[task.id]?.length)
        details.append(
          element(
            "p",
            `Shown because subtasks of ${task.title} match your filters.`,
          ),
        );
      details.append(renderTask(task, sections));
    }
    if (!current.archived && view.groupBy === "section") {
      const form = element("form"),
        input = element("input"),
        save = element("button", "Add");
      input.required = true;
      input.maxLength = 300;
      input.placeholder = "What’s next for your pack?";
      input.setAttribute("aria-label", `New task in ${group.title}`);
      form.append(input, save);
      wireForm(
        form,
        save,
        () =>
          void mutation("create_task", {
            title: input.value,
            sectionId: group.sectionId,
          }),
      );
      details.append(form);
    }
    root.append(details);
  }
  if (!current.archived && view.groupBy !== "section") {
    const form = element("form"),
      input = element("input"),
      save = element("button", "Add");
    input.required = true;
    input.maxLength = 300;
    input.setAttribute("aria-label", "New task");
    form.append(input, save);
    wireForm(
      form,
      save,
      () => void mutation("create_task", { title: input.value }),
    );
    root.append(form);
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
function renderEmpireSettings(data: EmpireSettings, canManage: boolean) {
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

let pendingHome: {
  version: number;
  settings: DashboardSettings;
  operationId: string;
} | null = null;
function renderDashboard(data: Dashboard) {
  clearViewEditors();
  root.replaceChildren(
    element("h1", "Wuff do I need to know?"),
    element("p", `Welcome back, ${data.name}.`),
    button("Your lists", () => void call("show_lists", {})),
  );
  const labels = {
    today: "Today",
    upcoming: "Coming up",
    favorites: "Favorites",
  };
  for (const section of data.preferences.settings.sections.filter(
    (id) => !data.preferences.settings.hidden.includes(id),
  )) {
    const card = element("section"),
      heading = element("h2", labels[section]);
    card.className = "list-header";
    card.append(heading);
    if (section === "favorites") {
      for (const list of data.favorites)
        card.append(
          button(
            `${list.title}${list.shared ? " · Shared" : ""}`,
            () => void call("show_list", { listId: list.id }),
          ),
        );
      if (!data.favorites.length)
        card.append(
          element("p", "Add your regular lists to Favorites in list settings."),
        );
    } else {
      const tasks = section === "today" ? data.todayTasks : data.upcomingTasks,
        total = section === "today" ? data.todayTotal : data.upcomingTotal;
      card.append(
        element(
          "p",
          section === "today"
            ? "Due today and anything still overdue."
            : `Tomorrow through ${formatDueDate(data.through)}.`,
        ),
      );
      for (const task of tasks) {
        const open = button(task.title, () => {
          taskExpanded.set(task.id, true);
          void call("get_task", { task: task.id });
        });
        open.className = "wuff-button list";
        card.append(
          open,
          element(
            "p",
            `${task.list.title}${task.parentTitle ? ` · ${task.parentTitle}` : ""}${task.list.shared ? " · Shared" : ""} · ${task.dueDate < data.today ? "Overdue · " : ""}${formatDueDate(task.dueDate)}`,
          ),
        );
      }
      if (!tasks.length)
        card.append(
          element(
            "p",
            section === "today"
              ? "Nothing due today. A little breathing room for your pack."
              : "No tasks dated for the next seven days.",
          ),
        );
      if (total > tasks.length)
        card.append(
          button(
            `Show more ${labels[section].toLowerCase()} tasks`,
            () =>
              void call("show_dashboard", {
                today: data.today,
                limit: Math.min(100, tasks.length + 10),
              }),
            tasks.length >= 100,
          ),
        );
    }
    root.append(card);
  }
  if (data.preferences.settings.hidden.length === 3)
    root.append(
      element(
        "p",
        "A quiet corner for your pack. Customize Home to bring a section back.",
      ),
    );
  const details = element("details"),
    summary = element("summary", "Customize Home"),
    form = element("form"),
    fields = element("fieldset");
  details.className = "home-customize";
  details.open = !!pendingHome;
  details.append(summary, form);
  form.append(fields);
  let draft: DashboardSettings = structuredClone(data.preferences.settings),
    saving = false;
  function controls() {
    fields.replaceChildren(element("legend", "Your Home sections"));
    for (const [i, id] of draft.sections.entries()) {
      const row = element("div"),
        label = element("label", labels[id]),
        check = element("input");
      row.className = "home-section-choice";
      check.type = "checkbox";
      check.checked = !draft.hidden.includes(id);
      check.addEventListener("change", () => {
        draft.hidden = check.checked
          ? draft.hidden.filter((s) => s !== id)
          : [...draft.hidden, id];
      });
      label.prepend(check);
      row.append(label);
      for (const delta of [-1, 1]) {
        row.append(
          button(
            `Move ${labels[id]} ${delta < 0 ? "up" : "down"}`,
            () => {
              const sections = [...draft.sections];
              [sections[i], sections[i + delta]] = [
                sections[i + delta],
                sections[i],
              ];
              draft = { ...draft, sections };
              controls();
            },
            i + delta < 0 || i + delta >= 3,
          ),
        );
      }
      fields.append(row);
    }
    const label = element("label", "When I open Wuff"),
      start = element("select");
    for (const [value, text] of [
      ["home", "Show Home"],
      ["last_list", "Open my last list on this device"],
    ]) {
      const option = element("option", text);
      option.value = value;
      start.append(option);
    }
    start.value = draft.startPage;
    start.addEventListener("change", () => {
      draft.startPage = start.value as DashboardSettings["startPage"];
    });
    label.append(start);
    fields.append(
      label,
      button("Reset to default", () => {
        draft = structuredClone(defaultDashboardSettings);
        controls();
      }),
    );
    fields.disabled = !!pendingHome;
  }
  controls();
  const save = element(
    "button",
    pendingHome ? "Retry same request" : "Save Home settings",
  );
  save.type = "submit";
  const cancel = button(
    "Cancel",
    () => {
      draft = structuredClone(data.preferences.settings);
      controls();
      details.open = false;
    },
    !!pendingHome,
  );
  form.append(save, cancel);
  wireForm(form, save, async () => {
    if (saving) return;
    saving = true;
    fields.disabled = true;
    save.disabled = true;
    cancel.disabled = true;
    const input = pendingHome ?? {
      version: data.preferences.version,
      settings: draft,
      operationId: crypto.randomUUID(),
    };
    try {
      await request("update_dashboard", input);
      pendingHome = null;
      show(
        await request("get_dashboard", {
          today: data.today,
          limit: Math.max(data.todayTasks.length, data.upcomingTasks.length, 5),
        }),
      );
      status.textContent = "Your Home settings are saved.";
    } catch (e) {
      pendingHome =
        e instanceof ToolError && e.code !== "internal_error" ? null : input;
      status.textContent = (e as Error).message;
      if (e instanceof ToolError && e.code === "conflict")
        status.append(
          button(
            "Reload saved settings",
            () => void call("get_dashboard", { today: data.today }),
          ),
        );
      fields.disabled = !!pendingHome;
      save.textContent = pendingHome
        ? "Retry same request"
        : "Save Home settings";
    } finally {
      saving = false;
      save.disabled = false;
      cancel.disabled = !!pendingHome;
    }
  });
  root.append(
    details,
    button(
      "Refresh Home",
      () => void call("show_dashboard", { today: calendarDay() }),
    ),
  );
}

function renderCatalog() {
  clearViewEditors();
  root.replaceChildren(
    element("h1", archive ? wuffCopy.archiveHeading : wuffCopy.listsHeading),
  );
  root.append(
    button("Home", () => void call("show_dashboard", { today: calendarDay() })),
    button(archive ? "Back to lists" : "Archive", () => {
      archive = !archive;
      renderCatalog();
    }),
  );
  const favorites = catalog.filter((list) => list.favorite && !list.archived);
  let favoriteSection: HTMLElement | null = null;
  if (!archive && favorites.length) {
    favoriteSection = element("nav");
    favoriteSection.setAttribute("aria-label", "Favorite lists");
    favoriteSection.append(element("h2", "Favorites"));
    root.append(favoriteSection);
  }
  const visible = catalog.filter((l) => l.archived === archive);
  const groups = sidebarGroups(catalog, archive);
  if (favoriteSection && groups.length)
    root.append(element("h2", "Other lists"));
  const rows = [
    ...(!archive
      ? favorites.map((list) => ({
          list,
          siblings: favorites,
          depth: 0,
          children: [] as ListSummary[],
        }))
      : []),
    ...groups.flatMap(({ list, children }) => [
      { list, siblings: groups.map((group) => group.list), depth: 0, children },
      ...(!list.sidebarCollapsed
        ? children.map((child) => ({
            list: child,
            siblings: children,
            depth: 1,
            children: [] as ListSummary[],
          }))
        : []),
    ]),
  ];
  for (const { list, siblings, depth, children } of rows) {
    const i = siblings.findIndex((item) => item.id === list.id);
    const row = element("div");
    row.className = "catalog-row";
    const main = element("div");
    main.className = "catalog-list";
    row.append(main);
    if (depth) row.style.marginLeft = "24px";
    if (children.length) {
      const collapse = button(
        list.sidebarCollapsed ? "▸" : "▾",
        () =>
          void changeCatalogOrder((order) => ({
            collapsedListIds: (order.collapsedListIds ?? []).includes(list.id)
              ? (order.collapsedListIds ?? []).filter((id) => id !== list.id)
              : [...(order.collapsedListIds ?? []), list.id],
          })),
      );
      collapse.setAttribute(
        "aria-label",
        `${list.sidebarCollapsed ? "Expand" : "Collapse"} ${list.title}`,
      );
      collapse.setAttribute("aria-expanded", String(!list.sidebarCollapsed));
      main.append(collapse);
    }
    const open = button(
      list.title,
      () => void call("show_list", { listId: list.id }),
    );
    open.className = "wuff-button list";
    open.style.borderLeft = `5px solid ${listPalette[list.color].accent}`;
    if (list.shared) {
      const shared = element("span", "Shared");
      shared.className = "status-tag";
      shared.style.marginLeft = "8px";
      open.append(shared);
      open.title = "Shared list";
    }
    const actions = element("details"),
      menu = element("div"),
      trigger = element("summary", "⋯");
    actions.className = "catalog-actions";
    trigger.setAttribute("aria-label", `More actions for list ${list.title}`);
    actions.append(trigger, menu);
    main.append(open);
    row.append(actions);
    menu.append(
      button(
        list.favorite ? "Remove from favorites" : "Add to favorites",
        () =>
          void changeCatalogOrder((order) => ({
            favoriteListIds: [
              ...(order.favoriteListIds ?? []).filter((id) => id !== list.id),
              ...(list.favorite ? [] : [list.id]),
            ],
          })),
      ),
    );
    for (const [dir, label] of [
      [-1, "up"],
      [1, "down"],
    ] as const) {
      menu.append(
        button(
          `Move ${list.title} ${label}`,
          () => void reorder(list.id, siblings[i + dir].id),
          i + dir < 0 || i + dir >= siblings.length,
        ),
      );
    }
    const parentLabel = element("label", "Parent list (your sidebar)");
    const parent = element("select");
    parent.setAttribute("aria-label", `Parent list for ${list.title}`);
    const top = element("option", "Top level");
    top.value = "";
    parent.append(top);
    for (const candidate of catalog.filter(
      (item) =>
        item.id !== list.id &&
        !item.parentListId &&
        item.archived === list.archived,
    )) {
      const option = element("option", candidate.title);
      option.value = candidate.id;
      parent.append(option);
    }
    parent.value = list.parentListId ?? "";
    const hasChildren = catalog.some((item) => item.parentListId === list.id);
    parent.disabled = hasChildren;
    parentLabel.append(parent);
    menu.append(
      parentLabel,
      button(
        "Save location",
        () =>
          void changeCatalogOrder((order) => ({
            nesting: [
              ...(order.nesting ?? []).filter(
                (entry) => entry.listId !== list.id,
              ),
              ...(parent.value
                ? [{ listId: list.id, parentListId: parent.value }]
                : []),
            ],
            collapsedListIds: (order.collapsedListIds ?? []).filter(
              (id) => id !== parent.value,
            ),
          })),
        hasChildren,
      ),
    );
    if (hasChildren)
      menu.append(
        element(
          "p",
          "Move this list’s children first to keep one level of nesting.",
        ),
      );
    menu.append(
      element(
        "p",
        "Only your sidebar changes. Tasks, subtasks and sharing stay with each list.",
      ),
    );
    (list.favorite && favoriteSection ? favoriteSection : root).append(row);
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
let catalogOrderPending: Record<string, unknown> | null = null;
let catalogOrderBusy = false;
async function changeCatalogOrder(
  change: ((order: ListOrder) => Record<string, unknown>) | null,
) {
  if (catalogOrderBusy || (catalogOrderPending && change)) return;
  catalogOrderBusy = true;
  status.textContent = wuffCopy.saving;
  try {
    if (change) {
      const data = (await request("get_list_order", {})) as {
        order: ListOrder;
      };
      catalogOrderPending = {
        ...data.order,
        ...change(data.order),
        operationId: crypto.randomUUID(),
      };
    }
    await request("reorder_lists", catalogOrderPending!);
    catalogOrderPending = null;
    show(await request("show_lists", {}));
    status.textContent = "Paw-some, sidebar saved";
  } catch (e) {
    if (e instanceof ToolError && e.code !== "internal_error")
      catalogOrderPending = null;
    status.replaceChildren(element("span", wuffError((e as Error).message)));
    if (catalogOrderPending)
      status.append(
        button("Retry sidebar change", () => void changeCatalogOrder(null)),
      );
  } finally {
    catalogOrderBusy = false;
  }
}
async function reorder(id: string, target: string) {
  await changeCatalogOrder((order) => {
    const ids = [...order.listIds],
      a = ids.indexOf(id),
      b = ids.indexOf(target);
    const parents = new Map(
      (order.nesting ?? []).map((entry) => [entry.listId, entry.parentListId]),
    );
    const effectiveParent = (id: string) => {
      const parent = parents.get(id);
      return catalog.some(
        (list) => list.id === parent && list.archived === archive,
      )
        ? parent
        : undefined;
    };
    if (a < 0 || b < 0 || effectiveParent(id) !== effectiveParent(target))
      throw new Error(
        "Your pack of lists changed. Reopen the list view and try again.",
      );
    [ids[a], ids[b]] = [ids[b], ids[a]];
    return { listIds: ids };
  });
}
app.ontoolresult = (result) => show(result.structuredContent);
app.connect().catch(() => {
  status.textContent =
    "This view needs a helping paw. Open it in a client that supports MCP Apps.";
});

window.setInterval(refreshDueBadges, 30_000);
window.addEventListener("focus", refreshDueBadges);
document.addEventListener("visibilitychange", refreshDueBadges);

function githubDetails(task: Task, onLink?: (link: Task["github"]) => void) {
  const details = element("details"),
    summary = element("summary", "GitHub issue"),
    body = element("div");
  body.className = "github-panel";
  details.append(summary, body);
  details.open = githubExpanded.has(task.id);
  let polls = 0;
  let pending: { name: string; args: Record<string, unknown> } | null = null;
  async function load() {
    try {
      const data = (await request("get_github_task", { taskId: task.id })) as {
        github: { link: any };
      };
      const link = data.github.link;
      onLink?.(
        link
          ? {
              issueNumber: link.issueNumber,
              url: link.url,
              state: link.state,
              active: link.active,
            }
          : null,
      );
      if (link && ["pending", "creating"].includes(link.state) && polls++ < 12)
        setTimeout(() => {
          if (details.isConnected && details.open) void load();
        }, 3000);
      body.replaceChildren();
      const setup = element("a", "Manage repository connection");
      setup.href = `${webOrigin}/github?listId=${current!.id}`;
      setup.target = "_blank";
      setup.rel = "noreferrer";
      body.append(setup);
      async function act(
        name: string,
        extra: Record<string, unknown> = {},
        retry = false,
      ) {
        if (pending && !retry) {
          status.textContent = "Retry the previous GitHub request first.";
          return;
        }
        if (!pending)
          pending = {
            name,
            args: {
              listId: current!.id,
              taskId: task.id,
              version: current!.version,
              operationId: crypto.randomUUID(),
              ...extra,
            },
          };
        try {
          await request(pending.name, pending.args);
          pending = null;
          const result = (await request("get_list", {
            listId: current!.id,
          })) as { list: TodoList };
          show(result);
          status.textContent = "GitHub operation saved.";
        } catch (e) {
          status.textContent = (e as Error).message;
          body.append(
            button(
              "Retry previous GitHub request",
              () => void act(name, extra, true),
            ),
          );
        }
      }
      if (link) {
        const tag = element("span", link.active ? link.state : "Disconnected");
        tag.className = "status-tag";
        body.append(tag);
        if (link.url) {
          const a = element("a", `Issue #${link.issueNumber}`);
          a.href = link.url;
          a.target = "_blank";
          a.rel = "noreferrer";
          body.append(a);
        }
        if (link.error)
          body.append(
            element(
              "p",
              `Sync needs attention: ${link.error}. Reconcile before creating another issue.`,
            ),
          );
        body.append(
          button(
            "Reconcile now",
            () => void act("retry_github_sync"),
            current!.archived,
          ),
        );
        if (link.conflict) {
          for (const side of ["wuff", "github"]) {
            body.append(
              element("h3", side === "wuff" ? "Wuff" : "GitHub"),
              element("pre", JSON.stringify(link.conflict[side], null, 2)),
              button(
                `Keep ${side === "wuff" ? "Wuff" : "GitHub"}`,
                () =>
                  void act("resolve_github_conflict", {
                    revision: link.revision,
                    choice: side,
                  }),
                current!.archived,
              ),
            );
          }
        }
        if (current!.ownerId === viewerId)
          body.append(
            button(
              "Unlink issue",
              () => void act("unlink_github_issue"),
              current!.archived,
            ),
          );
        body.append(
          button("Load related pull requests", () => {
            void request("get_github_pull_requests", { taskId: task.id })
              .then((r: any) => {
                for (const pr of r.github.pullRequests) {
                  const a = element("a", `${pr.title} · ${pr.state}`);
                  a.href = pr.url;
                  a.target = "_blank";
                  a.rel = "noreferrer";
                  body.append(a);
                }
              })
              .catch((e) => {
                status.textContent = e.message;
              });
          }),
        );
      } else if (current!.ownerId === viewerId) {
        const label = element("label", "Existing issue number"),
          input = element("input");
        input.inputMode = "numeric";
        label.append(input);
        body.append(
          label,
          button(
            "Link existing issue",
            () => {
              if (/^\d+$/.test(input.value))
                void act("link_github_issue", {
                  issueNumber: Number(input.value),
                });
            },
            current!.archived,
          ),
          button(
            "Create GitHub issue",
            () => void act("link_github_issue"),
            current!.archived,
          ),
          element(
            "p",
            "Creates share this task’s title and supported notes with the connected repository. Private attachments are not exported.",
          ),
        );
      }
    } catch (e) {
      body.replaceChildren(element("p", (e as Error).message));
    }
  }
  details.ontoggle = () => {
    if (details.open) {
      githubExpanded.add(task.id);
      void load();
    } else githubExpanded.delete(task.id);
  };
  return details;
}

function renderTotake(data: TotakeSnapshot, canWrite: boolean) {
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
