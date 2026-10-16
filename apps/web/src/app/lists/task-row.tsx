"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  ListTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Task, TodoList } from "@wuff/contracts";
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
}) {
  const children = list.tasks.filter((t) => t.parentTaskId === task.id);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const subtasksOpen =
    expanded ?? (children.length > 0 || subtaskDrafts.has(task.id));
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
      className="group flex flex-wrap items-start gap-x-2 sm:gap-x-3 gap-y-2 py-3"
      data-task-id={task.id}
    >
      <button
        type="button"
        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
        disabled={disabled}
        className={`h-6 w-6 mt-1 shrink-0 rounded-full border-2 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${task.completed ? "bg-primary border-primary text-white" : "border-[#aabdcf] hover:bg-accent"}`}
        onClick={() =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            completed: !task.completed,
          })
        }
      >
        {task.completed && <Check size={15} />}
      </button>
      <InlineName
        afterName={<DueDateBadge task={task} today={today} />}
        value={task.title}
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
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Section
              <select
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
              </select>
            </label>
          ) : undefined
        }
        renderActions={({ edit, editing, trigger }) => (
          <div className="flex shrink-0 items-center task-actions">
            {!list.archived && (
              <Button
                ref={trigger}
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-primary"
                title="Edit task"
                aria-label={`Edit ${task.title}`}
                disabled={busy || editing}
                onClick={() => {
                  setDraftSection(task.sectionId);
                  edit();
                }}
              >
                <Pencil size={16} />
              </Button>
            )}
            {!task.parentTaskId && (!list.archived || children.length > 0) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`h-8 px-1.5 gap-1 ${children.length ? "text-primary" : "text-slate-400 hover:text-primary"}`}
                aria-label={`${children.length ? "Subtasks" : "Add subtasks"} for ${task.title}${children.length ? `: ${children.filter((t) => t.completed).length} of ${children.length} done` : ""}`}
                title="Little steps, big tail wags · Subtasks"
                aria-expanded={subtasksOpen}
                aria-controls={subtasksOpen ? `subtasks-${task.id}` : undefined}
                disabled={busy || editing}
                onClick={() => setExpanded(!subtasksOpen)}
              >
                <ListTree size={16} />
                {children.length > 0 && (
                  <span className="text-xs tabular-nums">
                    {children.filter((t) => t.completed).length}/
                    {children.length}
                  </span>
                )}
              </Button>
            )}
            <Button
              ref={dateTrigger}
              type="button"
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${dateOpen ? "bg-accent text-primary" : task.dueDate ? "text-primary" : "text-slate-400 hover:text-primary"}`}
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
              }}
            >
              <CalendarDays size={16} />
            </Button>
            <Button
              ref={notesTrigger}
              type="button"
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${notesOpen ? "bg-accent text-primary" : task.content ? "text-primary" : "text-slate-400 hover:text-primary"}`}
              title={notesOpen ? "Hide notes" : "Notes"}
              aria-label={`${notesOpen ? "Hide" : task.content ? "Edit" : "Add"} notes for ${task.title}`}
              aria-expanded={notesOpen}
              aria-controls={notesOpen ? `notes-${task.id}` : undefined}
              disabled={busy || editing || (list.archived && !task.content)}
              onClick={() => setNotesOpen((v) => !v)}
            >
              <FileText size={16} />
            </Button>
            {!list.archived && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-red-700"
                title="Delete task"
                aria-label={`Delete ${task.title}`}
                disabled={busy || editing}
                onClick={() =>
                  children.length
                    ? setConfirmDelete(true)
                    : change("/api/v1/tasks", "DELETE", body)
                }
              >
                <Trash2 size={16} />
              </Button>
            )}
            {dragHandle}
          </div>
        )}
      />
      {dateOpen && (
        <div id={`due-${task.id}`} className="basis-full min-w-0 pl-8 sm:pl-9">
          <TaskDueDate
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={dueDrafts}
            onClose={() => {
              setDateOpen(false);
              requestAnimationFrame(() => dateTrigger.current?.focus());
            }}
          />
        </div>
      )}
      {confirmDelete && children.length > 0 && !list.archived && (
        <div className="basis-full min-w-0 pl-8 grid gap-2" role="alert">
          <p className="text-sm text-slate-600">
            Paws before deleting: this removes “{task.title}” and all{" "}
            {children.length} subtasks for everyone. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => change("/api/v1/tasks", "DELETE", body)}
            >
              Delete task and subtasks
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
          className="basis-full min-w-0 pl-4 sm:pl-8"
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
          />
        </div>
      )}
      {notesOpen && (
        <div className="basis-full min-w-0 pl-8 sm:pl-9">
          <TaskNotes
            userId={userId}
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={drafts}
            onClose={() => {
              setNotesOpen(false);
              requestAnimationFrame(() => notesTrigger.current?.focus());
            }}
          />
        </div>
      )}
    </li>
  );
}

function Subtasks({
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
      <p className="text-xs text-slate-500 mb-1">
        Little steps, big tail wags. {items.filter((t) => t.completed).length}{" "}
        of {items.length} done.
      </p>
      <SortableList
        items={items}
        disabled={disabled}
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
              disabled={disabled}
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
                  dragHandle={!list.archived ? handle : undefined}
                />
              )}
            </SortableItem>
          ))}
        </ul>
      </SortableList>
      {!list.archived && (
        <form
          className="flex gap-2 mt-2"
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
          <input
            ref={input}
            autoFocus={items.length === 0}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value) subtaskDrafts.set(parent.id, e.target.value);
              else subtaskDrafts.delete(parent.id);
            }}
            aria-label={`New subtask for ${parent.title}`}
            placeholder="One little step for your pack…"
            maxLength={300}
            required
            readOnly={busy}
            className="min-w-0 flex-1 text-sm"
          />
          <Button
            type="submit"
            disabled={disabled}
            aria-label={`Add subtask to ${parent.title}`}
          >
            <Plus size={18} />
          </Button>
        </form>
      )}
    </section>
  );
}
