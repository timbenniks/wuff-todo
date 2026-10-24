"use client";
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import {
  CalendarDays,
  Bell,
  Check,
  FileText,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { defaultListView, type Task, type TodoList } from "@wuff/contracts";
import { NativeSelect } from "../../../native-select";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "../../../input-group";
import { Button } from "../../../button";
import { InlineName } from "./inline-name";
import { TaskNotes, type NoteDraft } from "./task-notes";
import type { ListChange } from "./list-settings";
import { TaskDueDate, type DueDateDraft } from "./task-due-date";
import { SortableList, SortableItem } from "../../components/sortable";
import { TaskActions } from "./task-actions";
import { TaskReminder } from "../../components/reminders/task-reminder";
import { TaskMetadata } from "./task-metadata";
import { TaskColumns, type WorkCellDraft } from "./task-columns";
import { StatusTag } from "../../../status-tag";

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
  rowProps,
  moveControl,
  rowRef,
  style,
  detailed = false,
  matchedChildren,
  disableChildDrag = false,
  onOpenTask,
  workDrafts,
  hidden = false,
}: {
  workDrafts?: Map<string, WorkCellDraft>;
  hidden?: boolean;
  task: Task;
  userId: string;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, NoteDraft>;
  subtaskDrafts: Map<string, string>;
  dueDrafts: Map<string, DueDateDraft>;
  today: string | null;
  rowProps?: HTMLAttributes<HTMLElement>;
  moveControl?: ReactNode;
  rowRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  detailed?: boolean;
  matchedChildren?: string[];
  disableChildDrag?: boolean;
  onOpenTask?: (id: string) => void;
}) {
  const children = list.tasks.filter((child) => child.parentTaskId === task.id);
  const [expanded, setExpanded] = useState(
    () =>
      subtaskDrafts.has(task.id) ||
      children.some((child) => drafts.has(child.id) || dueDrafts.has(child.id)),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(dueDrafts.has(task.id));
  const [notesOpen, setNotesOpen] = useState(drafts.has(task.id));
  const [draftSection, setDraftSection] = useState(task.sectionId);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const subtasksOpen = expanded || subtaskDrafts.has(task.id);
  const disabled = busy || list.archived;
  const body = { listId: list.id, version: list.version, taskId: task.id };
  const restoreFocus = () =>
    requestAnimationFrame(() => moreTrigger.current?.focus());
  const openDetails = onOpenTask ? () => onOpenTask(task.id) : undefined;
  const detailsClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (
      openDetails &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.button === 0
    ) {
      event.preventDefault();
      openDetails();
    }
  };
  return (
    <li
      hidden={hidden}
      {...rowProps}
      onClick={(event) => {
        if (
          !(event.target instanceof Element) ||
          event.target.closest(".task-row") !== event.currentTarget
        )
          return;
        const control = event.target.closest(
          "button, a, input, textarea, select, summary, [contenteditable], .task-panel, .task-subtask-panel, .task-summary, .task-metadata",
        );
        if (control && event.currentTarget.contains(control)) return;
        event.currentTarget
          .querySelector<HTMLAnchorElement>(".task-name a")
          ?.click();
      }}
      onKeyDown={(event) => {
        rowProps?.onKeyDown?.(event);
        if (event.target === event.currentTarget && event.key === "Enter") {
          event.preventDefault();
          event.currentTarget
            .querySelector<HTMLAnchorElement>(".task-name a")
            ?.click();
        }
      }}
      ref={rowRef}
      style={style}
      className="task-row"
      data-task-id={task.id}
      data-density={detailed ? "comfortable" : "compact"}
      data-completed={task.completed}
    >
      <button
        type="button"
        className="task-complete"
        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
        disabled={disabled}
        onClick={() =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            completed: !task.completed,
          })
        }
      >
        <span
          className={`task-checkbox ${task.completed ? "task-checkbox-done" : ""}`}
        >
          {task.completed && <Check size={15} aria-hidden="true" />}
        </span>
      </button>
      <InlineName
        className="task-name"
        compact
        focusFallback={moreTrigger}
        value={task.title}
        readHref={task.path}
        onOpen={detailsClick}
        label="Task name"
        editLabel={`Edit ${task.title}`}
        completed={task.completed}
        editable={!list.archived}
        disabled={busy}
        onSave={(title) =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            title,
            ...(list.sections.length && !task.completed && !task.parentTaskId
              ? { sectionId: draftSection }
              : {}),
          })
        }
        additionalDirty={draftSection !== task.sectionId}
        additionalFields={
          list.sections.length && !task.completed && !task.parentTaskId ? (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Section
              <NativeSelect
                aria-label={`Section for ${task.title}`}
                value={draftSection ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  setDraftSection(event.target.value || null)
                }
              >
                <option value="">No section</option>
                {list.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : undefined
        }
        renderActions={({ edit, editing, trigger }) => (
          <TaskActions
            title={task.title}
            disabled={busy || editing}
            trigger={moreTrigger}
          >
            {(close) => (
              <>
                {moveControl}
                <a
                  href={task.path}
                  onClick={(event) => {
                    close();
                    detailsClick(event);
                  }}
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  Open task details
                </a>
                {!list.archived && (
                  <Button
                    type="button"
                    variant="ghost"
                    ref={trigger}
                    disabled={busy}
                    onClick={() => {
                      close();
                      setDraftSection(task.sectionId);
                      edit();
                    }}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Rename task
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || (list.archived && !task.content)}
                  onClick={() => {
                    close();
                    setNotesOpen(!notesOpen);
                  }}
                >
                  <FileText size={16} aria-hidden="true" />
                  {task.content ? "Edit notes" : "Add notes"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => {
                    close();
                    if (!dateOpen && !dueDrafts.has(task.id))
                      dueDrafts.set(task.id, {
                        value: task.dueDate ?? "",
                        base: task.dueDate,
                      });
                    setDateOpen(!dateOpen);
                  }}
                >
                  <CalendarDays size={16} aria-hidden="true" />
                  {task.dueDate ? "Change due date" : "Set due date"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    close();
                    setReminderOpen(!reminderOpen);
                  }}
                >
                  <Bell size={16} aria-hidden="true" />
                  Remind me
                </Button>
                {!task.parentTaskId && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || (list.archived && !children.length)}
                    onClick={() => {
                      close();
                      setExpanded(!subtasksOpen);
                    }}
                  >
                    <ListTree size={16} aria-hidden="true" />
                    {children.length ? "Manage subtasks" : "Add subtask"}
                  </Button>
                )}
                {list.mode === "work" && (
                  <a
                    href={task.path}
                    onClick={(event) => {
                      close();
                      detailsClick(event);
                    }}
                  >
                    Status, priority &amp; assignment
                  </a>
                )}
                {!!list.sections.length &&
                  !task.parentTaskId &&
                  !task.completed &&
                  !list.archived && (
                    <label className="task-menu-section">
                      Move to section
                      <NativeSelect
                        aria-label={`Move ${task.title} to section`}
                        value={task.sectionId ?? ""}
                        disabled={disabled}
                        onChange={async (event) => {
                          if (
                            await change("/api/v1/tasks", "PATCH", {
                              ...body,
                              sectionId: event.target.value || null,
                            })
                          )
                            close();
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
                {!list.archived && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="task-delete"
                    disabled={busy}
                    onClick={() => {
                      close();
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete task
                  </Button>
                )}
              </>
            )}
          </TaskActions>
        )}
      />
      <div className="task-quick-actions">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Quick ${task.content ? "edit" : "add"} notes for ${task.title}`}
          title={task.content ? "Edit notes" : "Add notes"}
          disabled={busy || (list.archived && !task.content)}
          onClick={() => setNotesOpen(true)}
        >
          <FileText size={16} />
        </Button>
        {!task.parentTaskId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quick subtasks for ${task.title}`}
            title="Subtasks"
            disabled={busy || (list.archived && !children.length)}
            onClick={() => setExpanded(!subtasksOpen)}
          >
            <ListTree size={16} />
          </Button>
        )}
      </div>
      <TaskColumns
        dueDrafts={dueDrafts}
        drafts={workDrafts}
        task={task}
        list={list}
        busy={busy}
        change={change}
        today={today}
      />
      {list.mode === "work" &&
        (list.personalView?.view ?? defaultListView()).rowStyle ===
          "columns" && (
          <TaskMetadata
            task={task}
            list={list}
            today={today}
            comfortable
            className="task-summary-columns"
            excludeKinds={[
              ...(list.personalView?.view ?? defaultListView()).columns,
              ...(!detailed ? ["key", "references"] : []),
            ]}
            onDetails={openDetails}
            onNotes={() => setNotesOpen(true)}
            onSubtasks={() => setExpanded(!subtasksOpen)}
          />
        )}
      {list.mode === "work" && (
        <div className="task-phone-work-summary">
          <StatusTag status={task.status} />
          <span className="task-phone-assignee">
            {list.assignees.find((a) => a.id === task.assigneeId)?.name ??
              "Unassigned"}
          </span>
        </div>
      )}
      <TaskMetadata
        task={task}
        list={list}
        today={today}
        comfortable={detailed}
        onDetails={openDetails}
        onNotes={() => setNotesOpen(true)}
        onSubtasks={() => setExpanded(!subtasksOpen)}
      />
      {!!matchedChildren?.length && (
        <p className="task-metadata text-xs text-muted-foreground">
          {matchedChildren.length} matching subtasks ·{" "}
          <button
            type="button"
            className="underline min-h-11"
            onClick={() => setExpanded(true)}
          >
            Show context
          </button>
        </p>
      )}
      {reminderOpen && (
        <div className="task-panel">
          <TaskReminder
            key={`${task.id}:${task.completed}`}
            listId={list.id}
            taskId={task.id}
            userId={userId}
            inactive={task.completed || list.archived}
            onClose={() => setReminderOpen(false)}
          />
        </div>
      )}
      {dateOpen && (
        <div className="task-panel">
          <TaskDueDate
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={dueDrafts}
            onClose={() => {
              setDateOpen(false);
              restoreFocus();
            }}
          />
        </div>
      )}
      {confirmDelete && !list.archived && (
        <div className="task-panel grid gap-2" role="alert">
          <p className="text-sm text-muted-foreground">
            Delete “{task.title}”
            {children.length ? ` and all ${children.length} subtasks` : ""} for
            everyone? This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => change("/api/v1/tasks", "DELETE", body)}
            >
              {children.length ? "Delete task and subtasks" : "Delete task"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                restoreFocus();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {!task.parentTaskId && subtasksOpen && (
        <div id={`subtasks-${task.id}`} className="task-subtask-panel">
          <Subtasks
            workDrafts={workDrafts}
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
            detailed={detailed}
            onOpenTask={onOpenTask}
          />
        </div>
      )}
      {notesOpen && (
        <div className="task-panel">
          <TaskNotes
            userId={userId}
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={drafts}
            onClose={() => {
              setNotesOpen(false);
              restoreFocus();
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
  workDrafts,
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
  workDrafts?: Map<string, WorkCellDraft>;
  today: string | null;
  focusNewTask?: boolean;
  disableDrag?: boolean;
  detailed?: boolean;
  onOpenTask?: (id: string) => void;
}) {
  const [title, setTitle] = useState(subtaskDrafts.get(parent.id) ?? "");
  const inputId = useId();
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
        {(orderedItems) => (
          <ul aria-label={`Subtasks of ${parent.title}`}>
            {orderedItems.map((task) => (
              <SortableItem
                key={task.id}
                id={task.id}
                title={task.title}
                disabled={disabled || disableDrag}
                entireRow
              >
                {({ ref, style, rowProps, moveControl }) => (
                  <TaskRow
                    workDrafts={workDrafts}
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
                    rowProps={rowProps}
                    moveControl={moveControl}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        )}
      </SortableList>
      {!list.archived && (
        <form
          className="task-add grid gap-1 mt-3"
          data-unsaved={!!title || undefined}
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
          <label className="text-xs text-muted-foreground" htmlFor={inputId}>
            New subtask
          </label>
          <InputGroup>
            <InputGroupInput
              id={inputId}
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
