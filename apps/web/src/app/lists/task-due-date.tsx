"use client";
import { useRef, useState } from "react";
import { dueDateSchema, type Task, type TodoList } from "@wuff/contracts";
import {
  calendarDay,
  dueDatePresentation,
  formatDueDate,
} from "@/lib/due-date";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
export type DueDateDraft = { value: string; base: string | null };
export function DueDateBadge({
  task,
  today,
}: {
  task: Task;
  today: string | null;
}) {
  if (!task.dueDate) return null;
  const display = dueDatePresentation(task.dueDate, task.completed, today);
  return (
    <p
      className={`mt-1 text-xs font-semibold break-words ${display.tone === "overdue" ? "text-red-700" : display.tone === "today" ? "text-primary" : "text-slate-500"}`}
      title={display.detail}
      aria-label={display.detail}
    >
      {display.label}
    </p>
  );
}
export function TaskDueDate({
  task,
  list,
  busy,
  change,
  drafts,
  onClose,
}: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, DueDateDraft>;
  onClose: () => void;
}) {
  const initial = drafts.get(task.id) ?? {
    value: task.dueDate ?? "",
    base: task.dueDate,
  };
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState("");
  const saving = useRef(false);
  const changed = (task.dueDate ?? null) !== (draft.base ?? null);
  const disabled = busy || list.archived;
  function pick(value: string) {
    const next = { ...draft, value };
    setDraft(next);
    drafts.set(task.id, next);
    setError("");
  }
  async function save(value: string | null) {
    if (disabled || saving.current) return;
    if (value !== null && !dueDateSchema.safeParse(value).success) {
      setError("That date needs a paw. Choose a real calendar date.");
      return;
    }
    pick(value ?? "");
    saving.current = true;
    setError("");
    try {
      if (
        await change("/api/v1/tasks", "PATCH", {
          listId: list.id,
          version: list.version,
          taskId: task.id,
          dueDate: value,
        })
      ) {
        drafts.delete(task.id);
        onClose();
      } else
        setError(
          "Ruff patch! The date wasn’t confirmed saved. Your pick is kept; check the message above.",
        );
    } catch {
      setError(
        "Ruff patch! The date wasn’t saved. Your pick is kept. Try again.",
      );
    } finally {
      saving.current = false;
    }
  }
  return (
    <form
      noValidate
      aria-label={`Due date for ${task.title}`}
      className="rounded-xl border border-border bg-white p-3 sm:p-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(String(new FormData(e.currentTarget).get("dueDate") ?? ""));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !disabled) {
          e.preventDefault();
          e.stopPropagation();
          drafts.delete(task.id);
          onClose();
        }
      }}
    >
      <p className="text-xs text-slate-500">
        Give this task a fetching finish date.
      </p>
      {list.archived ? (
        <p className="text-sm">
          This list is taking a paws. Restore it before changing dates.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => void save(calendarDay())}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => void save(calendarDay(1))}
            >
              Tomorrow
            </Button>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            Due date
            <input
              autoFocus
              type="date"
              name="dueDate"
              aria-label={`Choose due date for ${task.title}`}
              value={draft.value}
              min="0001-01-01"
              max="9999-12-31"
              readOnly={busy}
              onInput={(e) => pick(e.currentTarget.value)}
              onChange={(e) => pick(e.target.value)}
              className="w-full min-w-0 text-sm"
            />
          </label>
          {changed && (
            <p role="status" className="text-xs text-slate-600">
              New de-tails! The due date changed to{" "}
              {task.dueDate ? formatDueDate(task.dueDate) : "no date"} while you
              were choosing. Your pick is kept.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={disabled}>
              {busy
                ? "Saving, paws a moment…"
                : changed
                  ? "Save my date"
                  : "Save date"}
            </Button>
            {task.dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => void save(null)}
              >
                Clear date
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                drafts.delete(task.id);
                onClose();
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {list.archived && (
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
