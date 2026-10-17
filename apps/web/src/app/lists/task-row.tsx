"use client";
import { NativeSelect } from "@/components/ui/native-select";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Check,
  FileText,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { type Task, type TodoList } from "@wuff/contracts";
import { StatusTag } from "@/components/ui/status-tag";
import { Button } from "@/components/ui/button";
import { InlineName } from "./inline-name";
import { TaskNotes, type NoteDraft } from "./task-notes";
import type { ListChange } from "./list-settings";
import { TaskDueDate, DueDateBadge, type DueDateDraft } from "./task-due-date";
import { SortableList, SortableItem } from "@/components/sortable";
export function TaskRow({
  task,
  userId,
  list,
  busy,
  change,
  drafts,
  subtaskDrafts,
  dueDrafts,
  today,
  dragHandle,
  rowRef,
  style,
  detailed = false,
  matchedChildren,
  disableChildDrag = false,
}: {
  task: Task;
  userId: string;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, NoteDraft>;
  subtaskDrafts: Map<string, string>;
  dueDrafts: Map<string, DueDateDraft>;
  today: string | null;
  dragHandle?: ReactNode;
  rowRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  detailed?: boolean;
  matchedChildren?: string[];
  disableChildDrag?: boolean;
}) {
  const children = list.tasks.filter((t) => t.parentTaskId === task.id);
  const [expanded, setExpanded] = useState(
    () =>
      subtaskDrafts.has(task.id) ||
      children.some((child) => drafts.has(child.id) || dueDrafts.has(child.id)),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const actionRegion = useRef<HTMLDivElement>(null);
  const actionPanel = useRef<HTMLDivElement>(null);
  const [menuLayout, setMenuLayout] = useState({ up: false, height: 420 });
  useLayoutEffect(() => {
    if (!moreOpen) return;
    function place() {
      const trigger = moreTrigger.current,
        panel = actionPanel.current;
      if (!trigger || !panel || window.innerWidth >= 640) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12,
        above = rect.top - 12;
      const up = below < Math.min(panel.scrollHeight, 360) && above > below;
      const height = Math.max(80, up ? above : below);
      setMenuLayout((current) =>
        current.up === up && current.height === height
          ? current
          : { up, height },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [moreOpen]);
  function restoreActionFocus(target: HTMLButtonElement | null) {
    requestAnimationFrame(() => {
      if (target?.getClientRects().length) target.focus();
      else moreTrigger.current?.focus();
    });
  }
  useEffect(() => {
    if (!moreOpen) return;
    function outside(event: Event) {
      if (
        event.target instanceof Node &&
        !actionRegion.current?.contains(event.target)
      )
        setMoreOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("click", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("click", outside);
    };
  }, [moreOpen]);
  const subtasksOpen = expanded || subtaskDrafts.has(task.id);
  const [dateOpen, setDateOpen] = useState(dueDrafts.has(task.id)),
    dateTrigger = useRef<HTMLButtonElement>(null);
  const [draftSection, setDraftSection] = useState(task.sectionId);
  const [notesOpen, setNotesOpen] = useState(drafts.has(task.id)),
    notesTrigger = useRef<HTMLButtonElement>(null);
  const disabled = busy || list.archived,
    body = { listId: list.id, version: list.version, taskId: task.id };
  return (
    <li
      ref={rowRef}
      style={style}
      className="task-row group flex flex-wrap items-start gap-x-2 gap-y-1 py-2"
      data-task-id={task.id}
    >
      <button
        type="button"
        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
        disabled={disabled}
        className="task-complete h-11 w-11 shrink-0 rounded-full flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
        onClick={() =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            completed: !task.completed,
          })
        }
      >
        <span
          className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center ${task.completed ? "bg-primary border-primary text-white" : "border-control hover:bg-accent"}`}
        >
          {task.completed && <Check size={15} />}
        </span>
      </button>
      <InlineName
        className="task-name"
        compact
        focusFallback={moreTrigger}
        afterName={<DueDateBadge task={task} today={today} />}
        value={task.title}
        readHref={task.path}
        label="Task name"
        editLabel={`Edit ${task.title}`}
        completed={task.completed}
        editable={!list.archived}
        disabled={busy}
        onSave={(title) =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            title,
            ...(list.sections.length > 0 &&
            !task.completed &&
            !task.parentTaskId
              ? { sectionId: draftSection }
              : {}),
          })
        }
        additionalDirty={draftSection !== task.sectionId}
        additionalFields={
          list.sections.length > 0 && !task.completed && !task.parentTaskId ? (
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Section
              <NativeSelect
                className="text-sm max-w-full"
                aria-label={`Section for ${task.title}`}
                value={draftSection ?? ""}
                disabled={disabled}
                onChange={(e) => setDraftSection(e.target.value || null)}
              >
                <option value="">No section</option>
                {list.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : undefined
        }
        renderActions={({ edit, editing, trigger }) => (
          <div
            ref={actionRegion}
            className="flex shrink-0 items-center task-actions"
            data-editing={editing}
            data-expanded={moreOpen}
            onPointerDownCapture={(event) => {
              if ((event.target as HTMLElement).closest(".drag-handle"))
                setMoreOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && moreOpen) {
                e.preventDefault();
                setMoreOpen(false);
                moreTrigger.current?.focus();
              }
            }}
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              ref={moreTrigger}
              className="task-more"
              aria-label={`More actions for ${task.title}`}
              aria-expanded={moreOpen}
              aria-controls={`task-more-${task.id}`}
              disabled={busy || editing}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </Button>
            <div
              ref={actionPanel}
              id={`task-more-${task.id}`}
              className="task-action-panel"
              data-side={menuLayout.up ? "up" : "down"}
              style={
                {
                  "--task-menu-height": `${menuLayout.height}px`,
                } as CSSProperties
              }
            >
              <p className="task-menu-title">{task.title}</p>
              {!list.archived && (
                <Button
                  ref={trigger}
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="task-edit h-11 w-11 text-muted-foreground hover:text-primary"
                  title="Edit task"
                  aria-label={`Edit ${task.title}`}
                  disabled={busy || editing}
                  onClick={() => {
                    setDraftSection(task.sectionId);
                    setMoreOpen(false);
                    edit();
                  }}
                >
                  <Pencil size={16} />
                  <span className="task-action-label">Edit</span>
                </Button>
              )}
              {!task.parentTaskId && children.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={`task-subtasks ${children.length ? "" : "task-secondary"} h-11 px-2 gap-1 ${children.length ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  aria-label={`${children.length ? "Subtasks" : "Add subtasks"} for ${task.title}${children.length ? `: ${children.filter((t) => t.completed).length} of ${children.length} done` : ""}`}
                  title="Little steps, big tail wags · Subtasks"
                  aria-expanded={subtasksOpen}
                  aria-controls={
                    subtasksOpen ? `subtasks-${task.id}` : undefined
                  }
                  disabled={busy || editing}
                  onClick={() => {
                    setExpanded(!subtasksOpen);
                    setMoreOpen(false);
                  }}
                >
                  <ListTree size={16} />
                  <span className="task-action-label">Subtasks</span>
                  {children.length > 0 && (
                    <span className="text-xs tabular-nums">
                      {children.filter((t) => t.completed).length}/
                      {children.length}
                    </span>
                  )}
                </Button>
              )}
              <Button
                ref={notesTrigger}
                type="button"
                size="icon"
                variant="ghost"
                className={`task-notes-action h-11 w-11 ${notesOpen ? "bg-accent text-primary" : task.content ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                title={notesOpen ? "Hide notes" : "Notes"}
                aria-label={`${notesOpen ? "Hide" : task.content ? "Edit" : "Add"} notes for ${task.title}`}
                aria-expanded={notesOpen}
                aria-controls={notesOpen ? `notes-${task.id}` : undefined}
                disabled={busy || editing || (list.archived && !task.content)}
                onClick={() => {
                  setNotesOpen((v) => !v);
                  setMoreOpen(false);
                }}
              >
                <FileText size={16} />
                <span className="task-action-label">Notes</span>
              </Button>
              <div className="task-secondary-actions">
                {list.sections.length > 0 &&
                  !task.parentTaskId &&
                  !task.completed &&
                  !list.archived && (
                    <label className="task-menu-section sm:hidden">
                      Move to section
                      <NativeSelect
                        aria-label={`Move ${task.title} to section`}
                        value={task.sectionId ?? ""}
                        disabled={disabled}
                        onChange={async (e) => {
                          if (
                            await change("/api/v1/tasks", "PATCH", {
                              ...body,
                              sectionId: e.target.value || null,
                            })
                          )
                            setMoreOpen(false);
                        }}
                      >
                        <option value="">No section</option>
                        {list.sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.title}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  )}
                {!task.parentTaskId &&
                  !list.archived &&
                  children.length === 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={`task-subtasks ${children.length ? "" : "task-secondary"} h-11 px-2 gap-1 ${children.length ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                      aria-label={`${children.length ? "Subtasks" : "Add subtasks"} for ${task.title}${children.length ? `: ${children.filter((t) => t.completed).length} of ${children.length} done` : ""}`}
                      title="Little steps, big tail wags · Subtasks"
                      aria-expanded={subtasksOpen}
                      aria-controls={
                        subtasksOpen ? `subtasks-${task.id}` : undefined
                      }
                      disabled={busy || editing}
                      onClick={() => {
                        setExpanded(!subtasksOpen);
                        setMoreOpen(false);
                      }}
                    >
                      <ListTree size={16} />
                      <span className="task-action-label">Subtasks</span>
                    </Button>
                  )}
                <Button
                  ref={dateTrigger}
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={`task-date task-secondary h-11 w-11 ${dateOpen ? "bg-accent text-primary" : task.dueDate ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  title="Due date"
                  aria-label={`${dateOpen ? "Hide" : task.dueDate ? "Change" : "Set"} due date for ${task.title}`}
                  aria-expanded={dateOpen}
                  aria-controls={dateOpen ? `due-${task.id}` : undefined}
                  disabled={
                    busy ||
                    editing ||
                    (list.archived && !task.dueDate && !dueDrafts.has(task.id))
                  }
                  onClick={() => {
                    if (!dateOpen && !dueDrafts.has(task.id))
                      dueDrafts.set(task.id, {
                        value: task.dueDate ?? "",
                        base: task.dueDate ?? null,
                      });
                    setDateOpen(!dateOpen);
                    setMoreOpen(false);
                  }}
                >
                  <CalendarDays size={16} />
                  <span className="task-action-label">Date</span>
                </Button>
              </div>
            </div>
            {!list.archived && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="task-delete task-secondary h-11 w-11 text-muted-foreground hover:text-red-700"
                title="Delete task"
                aria-label={`Delete ${task.title}`}
                disabled={busy || editing}
                onClick={() => {
                  setMoreOpen(false);
                  setConfirmDelete(true);
                }}
              >
                <Trash2 size={16} />
                <span className="task-action-label">Delete</span>
              </Button>
            )}
            {dragHandle}
          </div>
        )}
      />
      {detailed && (
        <p className="col-span-full min-w-0 basis-full text-xs text-muted-foreground pl-8 pb-2 break-words">
          {task.key} · <StatusTag status={task.status} /> ·{" "}
          {task.priority === "none"
            ? "No priority"
            : `${task.priority} priority`}
          {task.assigneeId
            ? ` · ${list.assignees.find((a) => a.id === task.assigneeId)?.name ?? "Assigned"}`
            : ""}
          {task.references.length ? ` · ${task.references.length} links` : ""}
        </p>
      )}
      {!!matchedChildren?.length && (
        <p className="col-span-full min-w-0 basis-full text-xs text-primary pl-8">
          Shown because {matchedChildren.length} subtasks match your filters.
          Open subtasks to see the context.
        </p>
      )}
      {dateOpen && (
        <div
          id={`due-${task.id}`}
          className="task-panel basis-full min-w-0 pl-8 sm:pl-9"
        >
          <TaskDueDate
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={dueDrafts}
            onClose={() => {
              setDateOpen(false);
              restoreActionFocus(dateTrigger.current);
            }}
          />
        </div>
      )}
      {confirmDelete && !list.archived && (
        <div
          className="task-panel basis-full min-w-0 pl-8 grid gap-2"
          role="alert"
        >
          <p className="text-sm text-muted-foreground">
            Paws before deleting: this removes “{task.title}”
            {children.length ? ` and all ${children.length} subtasks` : ""} for
            everyone. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => change("/api/v1/tasks", "DELETE", body)}
            >
              {children.length ? "Delete task and subtasks" : "Delete task"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {!task.parentTaskId && subtasksOpen && (
        <div
          id={`subtasks-${task.id}`}
          className="task-subtask-panel basis-full min-w-0 pl-4 sm:pl-8"
        >
          <Subtasks
            parent={task}
            items={children}
            list={list}
            userId={userId}
            busy={busy}
            change={change}
            drafts={drafts}
            subtaskDrafts={subtaskDrafts}
            dueDrafts={dueDrafts}
            today={today}
            disableDrag={disableChildDrag}
          />
        </div>
      )}
      {notesOpen && (
        <div className="task-panel basis-full min-w-0 pl-8 sm:pl-9">
          <TaskNotes
            userId={userId}
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={drafts}
            onClose={() => {
              setNotesOpen(false);
              restoreActionFocus(notesTrigger.current);
            }}
          />
        </div>
      )}
    </li>
  );
}

export function Subtasks({
  parent,
  items,
  list,
  userId,
  busy,
  change,
  drafts,
  subtaskDrafts,
  dueDrafts,
  today,
  focusNewTask = true,
  disableDrag = false,
}: {
  parent: Task;
  items: Task[];
  list: TodoList;
  userId: string;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, NoteDraft>;
  subtaskDrafts: Map<string, string>;
  dueDrafts: Map<string, DueDateDraft>;
  today: string | null;
  focusNewTask?: boolean;
  disableDrag?: boolean;
}) {
  const [title, setTitle] = useState(subtaskDrafts.get(parent.id) ?? "");
  const disabled = busy || list.archived;
  const input = useRef<HTMLInputElement>(null);
  const body = {
    listId: list.id,
    version: list.version,
    parentTaskId: parent.id,
  };
  return (
    <section
      aria-label={`Subtasks for ${parent.title}`}
      className="border-l-2 border-primary/20 pl-3 sm:pl-4"
    >
      <p className="hidden sm:block text-xs text-muted-foreground mb-1">
        Little steps, big tail wags. {items.filter((t) => t.completed).length}{" "}
        of {items.length} done.
      </p>
      <SortableList
        items={items}
        disabled={disabled || disableDrag}
        onReorder={(taskIds) =>
          change("/api/v1/tasks", "PUT", { ...body, taskIds })
        }
      >
        <ul aria-label={`Subtasks of ${parent.title}`}>
          {items.map((task) => (
            <SortableItem
              key={task.id}
              id={task.id}
              title={task.title}
              disabled={disabled || disableDrag}
            >
              {({ ref, style, handle }) => (
                <TaskRow
                  task={task}
                  list={list}
                  userId={userId}
                  busy={busy}
                  change={change}
                  drafts={drafts}
                  subtaskDrafts={subtaskDrafts}
                  dueDrafts={dueDrafts}
                  today={today}
                  rowRef={ref}
                  style={style}
                  dragHandle={
                    !list.archived && !disableDrag ? handle : undefined
                  }
                />
              )}
            </SortableItem>
          ))}
        </ul>
      </SortableList>
      {!list.archived && (
        <form
          className="task-add grid gap-1 mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const sent = title;
            if (
              await change("/api/v1/tasks", "POST", { ...body, title: sent })
            ) {
              setTitle("");
              subtaskDrafts.delete(parent.id);
              requestAnimationFrame(() => input.current?.focus());
            }
          }}
        >
          <label
            className="text-xs text-muted-foreground"
            htmlFor={`new-child-${parent.id}`}
          >
            New subtask
          </label>
          <InputGroup>
            <InputGroupInput
              id={`new-child-${parent.id}`}
              ref={input}
              autoFocus={focusNewTask && items.length === 0}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value)
                  subtaskDrafts.set(parent.id, e.target.value);
                else subtaskDrafts.delete(parent.id);
              }}
              aria-label={`New subtask for ${parent.title}`}
              placeholder="One little step for your pack…"
              maxLength={300}
              required
              readOnly={busy}
              className="min-w-0 flex-1"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                variant="primary"
                size="sm"
                title="Add subtask"
                disabled={disabled}
                aria-label={`Add subtask to ${parent.title}`}
              >
                <Plus size={18} aria-hidden="true" /> Add
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      )}
    </section>
  );
}
