"use client";
import { useState, useEffect, useRef } from "react";
import {
  defaultListView,
  statusLabels,
  taskStatuses,
  taskPriorities,
  viewColumns,
  type Task,
  type TodoList,
} from "@wuff/contracts";
import { ViewPopover } from "./view-popover";
import { Button } from "../../../button";
import { NativeSelect } from "../../../native-select";
import { StatusTag } from "../../../status-tag";
import { TaskDueDate, type DueDateDraft, DueDateBadge } from "./task-due-date";
import type { ListChange } from "./list-settings";
type Column = (typeof viewColumns)[number];
export type WorkCellDraft = { value: string; base: number };
const field = {
  status: "status",
  priority: "priority",
  assignee: "assigneeId",
  due: "dueDate",
} as const;
const labels = {
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  due: "Due date",
};
function TaskCell({
  column,
  task,
  list,
  busy,
  change,
  drafts,
}: {
  column: Exclude<Column, "due">;
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  today: string | null;
  drafts?: Map<string, WorkCellDraft>;
}) {
  const value = () => task[field[column]] ?? "";
  const key = `${task.id}:${column}`,
    cached = drafts?.get(key);
  const [draft, setDraft] = useState<string>(() => cached?.value ?? value()),
    [base, setBase] = useState(cached?.base ?? list.version),
    [dirty, setDirty] = useState(!!cached),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!dirty) {
      setDraft(value());
      setBase(list.version);
    }
  }, [list.version, dirty]);
  const stale = dirty && base !== list.version;
  const edit = (value: string) => {
    setDraft(value);
    setDirty(true);
    drafts?.set(key, { value, base });
  };
  const load = () => {
    drafts?.delete(key);
    setDraft(value());
    setBase(list.version);
    setDirty(false);
    setNotice("");
  };
  const label =
    column === "status" ? (
      <StatusTag status={task.status} />
    ) : column === "priority" ? (
      <span className="capitalize">
        {task.priority === "none" ? "—" : task.priority}
      </span>
    ) : (
      <span className="truncate">
        {list.assignees.find((a) => a.id === task.assigneeId)?.name ??
          "Unassigned"}
      </span>
    );
  return (
    <div
      className={`work-cell work-cell-${column}`}
      data-visible={(
        list.personalView?.view ?? defaultListView()
      ).columns.includes(column)}
    >
      <ViewPopover
        label={label}
        showDone={false}
        variant="ghost"
        className="work-cell-trigger"
        ariaLabel={`Edit ${labels[column].toLowerCase()} for ${task.title}`}
        disabled={busy || list.archived}
        onOpen={() => {
          if (!dirty) load();
        }}
      >
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (stale || !dirty) return;
            const form = e.currentTarget;
            const ok = await change("/api/v1/tasks", "PATCH", {
              listId: list.id,
              taskId: task.id,
              version: base,
              [field[column]]: draft || null,
            });
            if (ok) {
              setDirty(false);
              drafts?.delete(key);
              setNotice("Saved");
              const panel = form.closest<HTMLElement>("[popover]");
              if (panel?.matches(":popover-open")) panel.hidePopover();
            }
          }}
        >
          <label className="grid gap-1 text-sm">
            {labels[column]}
            {
              <NativeSelect
                aria-label={`${labels[column]} for ${task.title}`}
                value={draft}
                disabled={busy}
                onChange={(e) => {
                  edit(e.target.value);
                }}
              >
                {column === "status" ? (
                  taskStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))
                ) : column === "priority" ? (
                  taskPriorities.map((p) => (
                    <option key={p} value={p}>
                      {p === "none"
                        ? "No priority"
                        : p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="">Unassigned</option>
                    {list.assignees.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </>
                )}
              </NativeSelect>
            }
          </label>
          {stale && (
            <p role="alert" className="text-sm">
              The list changed. Your draft is kept. Reload field values before
              saving.
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy || stale || !dirty}>
              Save {labels[column].toLowerCase()}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={(e) => {
                load();
                if (!stale)
                  e.currentTarget
                    .closest<HTMLElement>("[popover]")
                    ?.hidePopover();
              }}
            >
              {stale ? "Reload field values" : "Cancel"}
            </Button>
          </div>
        </form>
      </ViewPopover>
    </div>
  );
}
function DueDateCell({
  task,
  list,
  busy,
  change,
  today,
  drafts,
}: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  today: string | null;
  drafts?: Map<string, DueDateDraft>;
}) {
  const [editing, setEditing] = useState(false);
  const localDrafts = useRef(new Map<string, DueDateDraft>());
  const root = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={root}
      className="work-cell work-cell-due"
      data-visible={(
        list.personalView?.view ?? defaultListView()
      ).columns.includes("due")}
    >
      <ViewPopover
        label={
          task.dueDate ? (
            <DueDateBadge task={task} today={today} />
          ) : (
            <span className="text-muted-foreground">Set date</span>
          )
        }
        ariaLabel={`Edit due date for ${task.title}`}
        disabled={busy || list.archived}
        variant="ghost"
        className="work-cell-trigger"
        showDone={false}
        onOpen={() => setEditing(true)}
        onClose={() => setEditing(false)}
      >
        {editing && (
          <TaskDueDate
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={drafts ?? localDrafts.current}
            onClose={() =>
              root.current
                ?.querySelector<HTMLElement>("[popover]")
                ?.hidePopover()
            }
          />
        )}
      </ViewPopover>
    </div>
  );
}
export function TaskColumns(props: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  today: string | null;
  drafts?: Map<string, WorkCellDraft>;
  dueDrafts?: Map<string, DueDateDraft>;
}) {
  if (props.list.mode !== "work") return null;
  return (
    <>
      {viewColumns.map((column) =>
        column === "due" ? (
          <DueDateCell key={column} {...props} drafts={props.dueDrafts} />
        ) : (
          <TaskCell key={column} column={column} {...props} />
        ),
      )}
    </>
  );
}
