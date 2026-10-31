"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { TodoList } from "@wuff/contracts";
import { Button } from "../../../../button";
import { Input } from "../../../../input";
import { NativeSelect } from "../../../../native-select";
import type { ListChange } from "./list-settings";
import { inlineTaskRequest } from "../../lib/task-presentation";

export function InlineTaskComposer({
  list,
  sectionId = null,
  parentTaskId,
  busy,
  change,
  retry,
  onCreated,
  initialOpen = false,
  onClose,
  global = false,
  initialTitle = "",
  onDraft,
}: {
  list: TodoList;
  sectionId?: string | null;
  parentTaskId?: string;
  busy: boolean;
  change: ListChange;
  retry?: () => Promise<boolean>;
  onCreated?: (title: string) => void;
  initialOpen?: boolean;
  onClose?: () => void;
  global?: boolean;
  initialTitle?: string;
  onDraft?: (title: string) => void;
}) {
  const [open, setOpen] = useState(initialOpen || !!initialTitle),
    [title, setTitle] = useState(initialTitle);
  const [destination, setDestination] = useState(sectionId),
    [dueDate, setDueDate] = useState(""),
    [priority, setPriority] = useState("none");
  const [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false),
    [ownsRetry, setOwnsRetry] = useState(false);
  const pending = useRef(false),
    input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const locked = busy || saving || !!retry;
  function update(value: string) {
    setTitle(value);
    onDraft?.(value);
  }
  function finish() {
    onCreated?.(title.trim());
    update("");
    setNotice("");
    setOwnsRetry(false);
    requestAnimationFrame(() => input.current?.focus());
  }
  function cancel() {
    if (locked) return;
    update("");
    setDueDate("");
    setNotice("");
    setOpen(false);
    onClose?.();
    requestAnimationFrame(() => trigger.current?.focus());
  }
  if (list.archived) return null;
  const label = parentTaskId
    ? "Add subtask"
    : sectionId
      ? `Add task to ${list.sections.find((s) => s.id === sectionId)?.title ?? "section"}`
      : "Add task";
  return (
    <div
      className="inline-capture"
      data-unsaved={(open && !!title) || undefined}
      data-task-busy={saving || undefined}
    >
      {!open ? (
        <button
          ref={trigger}
          className="inline-capture-trigger"
          disabled={busy || !!retry}
          onClick={() => setOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
          {label}
        </button>
      ) : (
        <form
          aria-label={parentTaskId ? "Add subtask" : "Add task inline"}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cancel();
            }
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current || locked) return;
            let request;
            try {
              request = inlineTaskRequest(list, {
                title,
                sectionId: destination,
                parentTaskId,
                dueDate,
                priority,
              });
            } catch (error) {
              setNotice((error as Error).message);
              input.current?.focus();
              return;
            }
            pending.current = true;
            setSaving(true);
            setOwnsRetry(true);
            try {
              if (await change("/api/v1/tasks", "POST", request)) finish();
              else setNotice("Your task wasn’t confirmed. Your draft is kept.");
            } finally {
              pending.current = false;
              setSaving(false);
            }
          }}
        >
          <div className="inline-capture-line">
            <span className="task-checkbox" aria-hidden="true" />
            <Input
              ref={input}
              value={title}
              onChange={(event) => update(event.target.value)}
              aria-label={parentTaskId ? "Subtask name" : "Task name"}
              placeholder={parentTaskId ? "Subtask name" : "What needs doing?"}
              maxLength={300}
              required
              readOnly={locked}
            />
            <Button type="submit" variant="ghost" disabled={locked}>
              {saving ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cancel task creation"
              disabled={locked}
              onClick={cancel}
            >
              <X size={16} />
            </Button>
          </div>
          <details className="inline-capture-options">
            <summary>Task options</summary>
            <div>
              {global && !!list.sections.length && !parentTaskId && (
                <label>
                  Section
                  <NativeSelect
                    aria-label="Section for new task"
                    value={destination ?? ""}
                    disabled={locked}
                    onChange={(event) =>
                      setDestination(event.target.value || null)
                    }
                  >
                    <option value="">Tasks</option>
                    {list.sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              )}
              <label>
                Due date
                <Input
                  type="date"
                  aria-label="Due date for new task"
                  value={dueDate}
                  disabled={locked}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              {list.mode === "work" && (
                <label>
                  Priority
                  <NativeSelect
                    aria-label="Priority for new task"
                    value={priority}
                    disabled={locked}
                    onChange={(event) => setPriority(event.target.value)}
                  >
                    {["none", "low", "medium", "high", "urgent"].map(
                      (value) => (
                        <option key={value} value={value}>
                          {value === "none" ? "No priority" : value}
                        </option>
                      ),
                    )}
                  </NativeSelect>
                </label>
              )}
            </div>
          </details>
          {notice && <p role="status">{notice}</p>}
          {ownsRetry && retry && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || saving}
              onClick={async () => {
                if (pending.current) return;
                pending.current = true;
                setSaving(true);
                try {
                  if (await retry()) finish();
                } finally {
                  pending.current = false;
                  setSaving(false);
                }
              }}
            >
              Retry same request
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
