"use client";
import { Input } from "../../../../input";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Eraser, X } from "lucide-react";
import { dueDateSchema, type Task, type TodoList } from "@wuff/contracts";
import { calendarDay, dueDatePresentation } from "../../lib/due-date";
import { Button } from "../../../../button";
import type { ListChange } from "./list-settings";
export type DueDateDraft = {
  value: string;
  base: string | null;
  version?: number;
};
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
    <time
      dateTime={task.dueDate}
      className="status-tag due-tag"
      data-tone={
        display.tone === "overdue"
          ? "danger"
          : display.tone === "today"
            ? "active"
            : "neutral"
      }
      title={display.detail}
      aria-label={display.detail}
    >
      <CalendarDays className="task-due-icon" size={14} aria-hidden="true" />
      <span className="task-due-text">{display.label}</span>
    </time>
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
    version: list.version,
  };
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState("");
  const saving = useRef(false);
  const dirty = draft.value !== (draft.base ?? "");
  const changed =
    dirty && draft.version !== undefined && list.version !== draft.version;
  useEffect(() => {
    if (
      !dirty ||
      ((task.dueDate ?? "") === draft.value && list.version !== draft.version)
    ) {
      setDraft({
        value: task.dueDate ?? "",
        base: task.dueDate,
        version: list.version,
      });
      drafts.delete(task.id);
      setError("");
    }
  }, [task.dueDate, list.version]);
  const disabled = busy || list.archived;
  function pick(value: string) {
    const next = { ...draft, value };
    setDraft(next);
    drafts.set(task.id, next);
    setError("");
  }
  async function save(value: string | null) {
    if (disabled || saving.current || changed) return;
    if (value !== null && !dueDateSchema.safeParse(value).success) {
      setError("Choose a valid calendar date.");
      return;
    }
    pick(value ?? "");
    saving.current = true;
    setError("");
    try {
      if (
        await change("/api/v1/tasks", "PATCH", {
          listId: list.id,
          version: draft.version ?? list.version,
          taskId: task.id,
          dueDate: value,
        })
      ) {
        drafts.delete(task.id);
        onClose();
      } else
        setError(
          "The date wasn’t confirmed saved. Your draft is kept; retry the same request if offered.",
        );
    } catch {
      setError("The date wasn’t saved. Your draft is kept. Try again.");
    } finally {
      saving.current = false;
    }
  }
  return (
    <form
      noValidate
      aria-label={`Due date for ${task.title}`}
      data-unsaved={draft.value !== (task.dueDate ?? "") || undefined}
      className="rounded-xl border border-border bg-surface p-3 sm:p-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save(
          String(new FormData(e.currentTarget).get("dueDate") ?? "") || null,
        );
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !disabled) {
          e.preventDefault();
          e.stopPropagation();
          drafts.delete(task.id);
          setDraft({
            value: task.dueDate ?? "",
            base: task.dueDate,
            version: list.version,
          });
          onClose();
        }
      }}
    >
      <p className="text-xs text-muted-foreground">
        Choose a date or shortcut, then Save date. Clear date also waits for
        Save.
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
              onClick={() => pick(calendarDay())}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => pick(calendarDay(1))}
            >
              Tomorrow
            </Button>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Due date
            <Input
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
            <div role="status" className="text-xs">
              <p>
                The list changed while you were choosing. Your date draft is
                kept. Load latest date before saving.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  drafts.delete(task.id);
                  setDraft({
                    value: task.dueDate ?? "",
                    base: task.dueDate,
                    version: list.version,
                  });
                  setError("");
                }}
              >
                Load latest date
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={disabled || changed || !dirty}
              aria-label={busy ? "Saving date" : "Save date"}
              title="Save date"
            >
              <Check size={18} aria-hidden="true" />{" "}
              {busy ? "Saving…" : "Save date"}
            </Button>
            {task.dueDate && (
              <Button
                type="button"
                variant="ghost"
                aria-label="Clear date"
                title="Clear date"
                disabled={disabled}
                onClick={() => pick("")}
              >
                <Eraser size={18} aria-hidden="true" /> Clear date
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              aria-label="Cancel date"
              title="Cancel date"
              disabled={busy}
              onClick={() => {
                drafts.delete(task.id);
                setDraft({
                  value: task.dueDate ?? "",
                  base: task.dueDate,
                  version: list.version,
                });
                onClose();
              }}
            >
              <X size={18} aria-hidden="true" /> Cancel
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
