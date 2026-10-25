"use client";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "../../../../input-group";
import { wuffCopy } from "../../../../features/lib/copy";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  defaultListView,
  projectListView,
  type TodoList,
  type ViewGroup,
  type ListView,
  viewColumns,
} from "@wuff/contracts";
import { ListViewControls } from "./list-view-controls";
import { Button } from "../../../../button";
import type { ListChange } from "./list-settings";
import { type NoteDraft } from "./task-notes";
import type { WorkCellDraft } from "./task-columns";
import { TaskRow } from "./task-row";
import { SortableList, SortableItem } from "../../components/sortable";
import { mergeVisibleOrder } from "../../lib/reorder";
import { useCalendarDay } from "../../lib/use-calendar-day";
import type { DueDateDraft } from "./task-due-date";
import { InlineName } from "./inline-name";
import { CompletedTasks } from "./completed-tasks";
import { TaskDetailDrawer } from "./task-detail-drawer";

export function TaskGroups({
  list,
  userId,
  busy,
  change,
  error = "",
  retry,
  refresh,
}: {
  list: TodoList;
  userId: string;
  busy: boolean;
  change: ListChange;
  error?: string;
  retry?: () => Promise<boolean>;
  refresh: () => Promise<void>;
}) {
  const initialCompleted = useRef(
    new Set(list.tasks.filter((task) => task.completed).map((task) => task.id)),
  );
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const today = useCalendarDay();
  const workDrafts = useRef(new Map<string, WorkCellDraft>());
  const dueDrafts = useRef(new Map<string, DueDateDraft>());
  const noteDrafts = useRef(new Map<string, NoteDraft>()),
    subtaskDrafts = useRef(new Map<string, string>());
  useEffect(() => {
    for (const key of workDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === key.split(":")[0]))
        workDrafts.current.delete(key);
    for (const id of noteDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id)) noteDrafts.current.delete(id);
    for (const id of subtaskDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id))
        subtaskDrafts.current.delete(id);
    for (const id of dueDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id)) dueDrafts.current.delete(id);
  }, [list.tasks]);
  const [addingSection, setAddingSection] = useState(false);
  const [captureNotice, setCaptureNotice] = useState("");
  const owner = list.ownerId === userId,
    disabled = busy || list.archived;
  const body = { listId: list.id, version: list.version };
  const path = `/api/v1/lists/${list.id}/sections`;
  const [preview, setPreview] = useState<ListView | null>(null);
  const view = preview ?? list.personalView?.view ?? defaultListView();
  const workColumns = list.mode === "work" && view.rowStyle === "columns";
  const columns = viewColumns.filter((c) => view.columns.includes(c));
  const widths = {
    status: "130px",
    priority: "100px",
    assignee: "140px",
    due: "140px",
  };
  const grid = `44px minmax(180px,1fr) ${columns.map((c) => widths[c]).join(" ")} 88px 44px`;
  const groups = projectListView(list, view, today ?? "0001-01-01");
  const folded = new Set(
    view.completed === "all"
      ? groups.flatMap((group) =>
          group.tasks
            .filter(
              (task) =>
                task.completed &&
                initialCompleted.current.has(task.id) &&
                !list.tasks.some(
                  (child) => child.parentTaskId === task.id && !child.completed,
                ),
            )
            .map((task) => task.id),
        )
      : [],
  );
  const count = (group?: ViewGroup) =>
    group?.tasks.filter((task) => !folded.has(task.id)).length ?? 0;
  const filtersActive = !!(
    view.search ||
    view.sections.length ||
    view.statuses.length ||
    view.priorities.length ||
    view.assignees.length ||
    view.due !== "all" ||
    view.completed !== "all"
  );
  const created = (title: string) => setCaptureNotice(title);
  const active = list.tasks.filter((t) => !t.parentTaskId);
  const saveCollapsed = (id: string, open: boolean) => {
    if (preview) return;
    const collapsed = open
      ? view.collapsed.filter((v) => v !== id)
      : [...new Set([...view.collapsed, id])].slice(-200);
    if (JSON.stringify(collapsed) !== JSON.stringify(view.collapsed))
      void change(`/api/v1/lists/${list.id}/view`, "PUT", {
        listId: list.id,
        viewVersion: list.personalView?.version ?? 0,
        view: { ...view, collapsed },
      });
  };
  function rows(sectionId: string | null, group?: ViewGroup) {
    group ??= groups.find((g) => g.sectionId === sectionId);
    const items = group?.tasks ?? [];
    const manual = group?.sortBy === "manual";
    const childMatches = group?.childMatches ?? {};
    return (
      <SortableList
        items={items}
        disabled={disabled || !manual}
        onReorder={async (ids, before) => {
          const taskIds = mergeVisibleOrder(
            active.filter((t) => !t.completed).map((t) => t.id),
            before.filter((id) =>
              active.some((t) => t.id === id && !t.completed),
            ),
            ids.filter((id) => active.some((t) => t.id === id && !t.completed)),
          );
          if (taskIds)
            return await change("/api/v1/tasks", "PUT", { ...body, taskIds });
          return false;
        }}
      >
        {(orderedItems) => (
          <ul
            aria-label={
              sectionId
                ? `Tasks in ${list.sections.find((s) => s.id === sectionId)?.title}`
                : "Active tasks"
            }
            className="divide-y divide-border"
          >
            {orderedItems.map((task) => (
              <SortableItem
                key={task.id}
                id={task.id}
                title={task.title}
                disabled={disabled || !manual || task.completed}
                entireRow
              >
                {({ ref, style, rowProps, moveControl }) => (
                  <TaskRow
                    hidden={folded.has(task.id)}
                    workDrafts={workDrafts.current}
                    userId={userId}
                    rowRef={ref}
                    style={style}
                    task={task}
                    list={{
                      ...list,
                      personalView: {
                        version: list.personalView?.version ?? 0,
                        view,
                      },
                    }}
                    busy={busy}
                    change={change}
                    drafts={noteDrafts.current}
                    subtaskDrafts={subtaskDrafts.current}
                    dueDrafts={dueDrafts.current}
                    today={today}
                    detailed={view.layout === "detailed"}
                    matchedChildren={childMatches[task.id]}
                    disableChildDrag={!manual}
                    onOpenTask={setOpenTaskId}
                    rowProps={rowProps}
                    moveControl={moveControl}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        )}
      </SortableList>
    );
  }
  function addTask(sectionId: string | null) {
    return (
      !list.archived && (
        <form
          className="task-add grid gap-1 mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (disabled) return;
            const form = e.currentTarget;
            const title = String(new FormData(form).get("title")).trim();
            if (!title) return;
            if (
              await change("/api/v1/tasks", "POST", {
                ...body,
                sectionId,
                title,
              })
            ) {
              form.reset();
              created(title);
            }
          }}
        >
          <label
            className="text-xs text-muted-foreground"
            htmlFor={`new-task-${sectionId ?? "none"}`}
          >
            New task
          </label>
          <InputGroup>
            <InputGroupInput
              id={`new-task-${sectionId ?? "none"}`}
              name="title"
              aria-label={
                sectionId
                  ? `New task in ${list.sections.find((s) => s.id === sectionId)?.title}`
                  : "New task"
              }
              placeholder="What’s next for your pack?"
              maxLength={300}
              required
              className="flex-1"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="sm"
                variant="primary"
                disabled={disabled}
                type="submit"
                title="Add task"
                aria-label={
                  sectionId
                    ? `Add task to ${list.sections.find((s) => s.id === sectionId)?.title}`
                    : "Add task"
                }
              >
                <Plus size={18} aria-hidden="true" /> Add
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      )
    );
  }
  return (
    <div
      className={`workspace-task-list ${workColumns ? "work-columns" : ""}`}
      style={{ "--work-grid": grid } as CSSProperties}
    >
      {openTaskId && (
        <TaskDetailDrawer
          taskId={openTaskId}
          list={list}
          userId={userId}
          busy={busy}
          change={change}
          error={error}
          retry={retry}
          refresh={refresh}
          navigate={setOpenTaskId}
        />
      )}
      {list.archived && (
        <div
          role="status"
          className="rounded-xl border border-border bg-surface p-4 text-sm mb-6"
        >
          <p>
            This list is archived. Tasks, subtasks and sharing are kept.{" "}
            {owner
              ? "Restore it to edit again."
              : "Ask its owner to restore it so you can edit again."}
          </p>
          {owner && (
            <Button
              className="mt-3"
              variant="outline"
              disabled={busy}
              onClick={() =>
                change(`/api/v1/lists/${list.id}`, "PATCH", {
                  listId: list.id,
                  version: list.version,
                  archived: false,
                })
              }
            >
              Restore list
            </Button>
          )}
        </div>
      )}
      <ListViewControls
        retry={retry}
        error={error}
        onCreated={created}
        list={list}
        userId={userId}
        busy={busy}
        change={change}
        onPreview={setPreview}
        shown={groups.reduce((n, g) => n + g.tasks.length, 0)}
        total={active.length}
      />
      {captureNotice && (
        <p role="status" className="text-sm my-3 break-words">
          Added “{captureNotice}” to {list.title}.
          {filtersActive
            ? " Your filters still apply and may hide the task. Clear filters to see all tasks."
            : ""}
        </p>
      )}
      {workColumns && (
        <div className="work-column-headings" aria-hidden="true">
          <span className="work-task-heading">Task</span>
          {columns.map((c) => (
            <span key={c}>
              {c === "due" ? "Due date" : c[0].toUpperCase() + c.slice(1)}
            </span>
          ))}
          <span className="work-actions-heading">Actions</span>
        </div>
      )}
      {view.groupBy !== "section" ? (
        <>
          {groups
            .filter((g) => g.tasks.length)
            .map((g) => (
              <details
                key={g.id}
                open={!view.collapsed.includes(g.id)}
                onToggle={(e) => saveCollapsed(g.id, e.currentTarget.open)}
                className="mt-5"
              >
                <summary className="font-semibold py-3">
                  {g.title} ({count(g)})
                </summary>
                {rows(null, g)}
              </details>
            ))}
          {addTask(null)}
        </>
      ) : (
        <>
          <details
            open={!view.collapsed.includes("section:none")}
            onToggle={(e) =>
              saveCollapsed("section:none", e.currentTarget.open)
            }
          >
            <summary className="section-summary">
              {list.sections.length ? "No section" : "Tasks"} (
              {count(groups.find((g) => g.sectionId === null))})
            </summary>
            {rows(null)}
            {addTask(null)}
          </details>
          <SortableList
            items={list.sections}
            disabled={busy || !owner || list.archived}
            onReorder={(sectionIds) =>
              change(path, "PUT", { ...body, sectionIds })
            }
          >
            {list.sections.map((section) => (
              <SortableItem
                key={section.id}
                id={section.id}
                title={`section ${section.title}`}
                disabled={busy || !owner || list.archived}
              >
                {({ ref, style, handle }) => (
                  <section
                    ref={ref}
                    style={style}
                    className="mt-6 border-t border-border pt-3"
                  >
                    <div className="section-heading flex flex-wrap items-center gap-2 [&>div:first-child]:basis-full sm:[&>div:first-child]:basis-0">
                      <InlineName
                        value={section.title}
                        heading="h2"
                        label="Section name"
                        editLabel={`Rename section ${section.title}`}
                        editable={owner && !list.archived}
                        disabled={busy}
                        onSave={(title) =>
                          change(path, "PATCH", {
                            ...body,
                            sectionId: section.id,
                            title,
                          })
                        }
                        renderActions={
                          owner && !list.archived
                            ? ({ edit, editing, trigger }) => (
                                <div className="flex items-center">
                                  <Button
                                    ref={trigger}
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-11 w-11"
                                    aria-label={`Rename section ${section.title}`}
                                    title="Rename section"
                                    disabled={busy || editing}
                                    onClick={edit}
                                  >
                                    <Pencil size={15} />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-11 w-11 text-muted-foreground hover:text-red-700"
                                    disabled={busy || editing}
                                    title="Remove section"
                                    aria-label={`Remove section ${section.title}`}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Remove section “${section.title}”? Its tasks will be kept under No section.`,
                                        )
                                      )
                                        void change(path, "DELETE", {
                                          ...body,
                                          sectionId: section.id,
                                        });
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                  {handle}
                                </div>
                              )
                            : undefined
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        aria-expanded={
                          !view.collapsed.includes(`section:${section.id}`)
                        }
                        aria-label={`${view.collapsed.includes(`section:${section.id}`) ? "Expand" : "Collapse"} section ${section.title}`}
                        onClick={() =>
                          saveCollapsed(
                            `section:${section.id}`,
                            view.collapsed.includes(`section:${section.id}`),
                          )
                        }
                      >
                        {count(groups.find((g) => g.sectionId === section.id))}{" "}
                        task
                        {count(
                          groups.find((g) => g.sectionId === section.id),
                        ) === 1
                          ? ""
                          : "s"}{" "}
                        ·{" "}
                        {view.collapsed.includes(`section:${section.id}`)
                          ? "Show"
                          : "Hide"}
                      </Button>
                    </div>
                    {!view.collapsed.includes(`section:${section.id}`) && (
                      <div className="mt-2">
                        {rows(section.id)}
                        {addTask(section.id)}
                      </div>
                    )}
                  </section>
                )}
              </SortableItem>
            ))}
          </SortableList>
        </>
      )}
      <CompletedTasks
        list={list}
        groups={groups}
        ids={folded}
        busy={busy}
        change={change}
        openTask={setOpenTaskId}
      />
      {owner && !list.archived && (
        <div className="mt-6">
          {addingSection ? (
            <form
              className="min-w-0"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await change(path, "POST", {
                    ...body,
                    title: String(new FormData(e.currentTarget).get("title")),
                  })
                )
                  setAddingSection(false);
              }}
            >
              <label
                htmlFor={`new-section-${list.id}`}
                className="text-xs text-muted-foreground"
              >
                Section name
              </label>
              <InputGroup>
                <InputGroupInput
                  id={`new-section-${list.id}`}
                  name="title"
                  aria-label="Section name"
                  placeholder={wuffCopy.sectionPlaceholder}
                  maxLength={300}
                  required
                  autoFocus
                  className="flex-1"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="submit"
                    size="sm"
                    variant="primary"
                    disabled={busy}
                    aria-label="Save section"
                    title="Save section"
                  >
                    <Check size={18} aria-hidden="true" /> Add
                  </InputGroupButton>
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancel section"
                    title="Cancel section"
                    onClick={() => setAddingSection(false)}
                  >
                    <X size={18} />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          ) : (
            <Button
              variant="ghost"
              className="px-2 text-muted-foreground"
              aria-label="Add section"
              title="Add section"
              disabled={busy || list.sections.length >= 50}
              onClick={() => setAddingSection(true)}
            >
              <ListPlus size={18} aria-hidden="true" />
              <span>Add section</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
