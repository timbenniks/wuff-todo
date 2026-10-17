"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import {
  taskStatuses,
  taskPriorities,
  taskReferencesSchema,
  type Task,
  type TodoList,
} from "@wuff/contracts";
import { StatusTag } from "@/components/ui/status-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ListChange } from "../../lists/list-settings";

export const statusLabel = (value: string) =>
  ({
    todo: "Todo",
    in_progress: "In progress",
    in_review: "In review",
    blocked: "Blocked",
    done: "Done",
  })[value] ?? value;
export function WorkMetadata({
  task,
  list,
  busy,
  change,
}: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
}) {
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    setEditing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  if (list.mode !== "work" && !editing) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold">Work details</h2>
        {!list.archived && !editing && (
          <Button
            type="button"
            variant="ghost"
            aria-label="Edit work details"
            disabled={busy}
            ref={trigger}
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} aria-hidden="true" /> Edit details
          </Button>
        )}
      </div>
      {editing ? (
        <WorkForm
          task={task}
          list={list}
          busy={busy}
          change={change}
          close={close}
        />
      ) : (
        <>
          <dl className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs mb-1">Status</dt>
              <dd>
                <StatusTag status={task.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs mb-1">Priority</dt>
              <dd className="capitalize">
                {task.priority === "none" ? "No priority" : task.priority}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs mb-1">Assignee</dt>
              <dd>
                {list.assignees.find((p) => p.id === task.assigneeId)?.name ??
                  "Unassigned"}
              </dd>
            </div>
          </dl>
          <h3 className="text-xs text-muted-foreground mt-5 mb-2">
            References
          </h3>
          {task.references.length ? (
            <ul className="grid gap-2 text-sm">
              {task.references.map((ref, i) => (
                <li key={i} className="min-w-0">
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline break-all py-2 inline-block"
                  >
                    {ref.title || ref.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Link an issue, pull request or document.
            </p>
          )}
        </>
      )}
    </section>
  );
}
function WorkForm({
  task,
  list,
  busy,
  change,
  close,
}: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  close: () => void;
}) {
  const load = () => ({
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    references: task.references.map((r) => ({ ...r })),
    version: list.version,
  });
  const [draft, setDraft] = useState(load);
  const [error, setError] = useState("");
  const disabled = busy || list.archived || list.mode !== "work";
  const statusInput = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    statusInput.current?.focus();
  }, []);
  return (
    <form
      className="grid gap-4"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          close();
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const refs = taskReferencesSchema.safeParse(draft.references);
        if (!refs.success) {
          setError(refs.error.issues.map((i) => i.message).join("; "));
          return;
        }
        const ok = await change("/api/v1/tasks", "PATCH", {
          listId: list.id,
          taskId: task.id,
          ...draft,
          references: refs.data,
        });
        if (ok) close();
        else
          setError(
            "Your draft is kept. Check the message above before trying again.",
          );
      }}
    >
      {list.mode !== "work" && (
        <p role="status" className="text-sm text-muted-foreground">
          This list switched to Simple. Your work draft is kept until the owner
          enables Work again.
        </p>
      )}
      <label className="grid gap-2 text-sm">
        Status
        <NativeSelect
          aria-label="Status"
          ref={statusInput}
          value={draft.status}
          disabled={disabled}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as Task["status"] })
          }
        >
          {taskStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="grid gap-2 text-sm">
        Priority
        <NativeSelect
          aria-label="Priority"
          value={draft.priority}
          disabled={disabled}
          onChange={(e) =>
            setDraft({ ...draft, priority: e.target.value as Task["priority"] })
          }
        >
          {taskPriorities.map((p) => (
            <option key={p} value={p}>
              {p === "none" ? "No priority" : p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {list.assignees.length > 0 ? (
        <label className="grid gap-2 text-sm">
          Assignee
          <NativeSelect
            aria-label="Assignee"
            value={draft.assigneeId ?? ""}
            disabled={disabled}
            onChange={(e) =>
              setDraft({ ...draft, assigneeId: e.target.value || null })
            }
          >
            <option value="">Unassigned</option>
            {list.assignees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          Share this list to assign tasks.
        </p>
      )}
      <fieldset className="grid gap-3 min-w-0">
        <legend className="text-sm mb-2">References</legend>
        {draft.references.map((ref, i) => (
          <div
            key={i}
            className="grid gap-2 min-w-0 rounded-xl border border-border p-3"
          >
            <label className="grid gap-1 text-xs">
              Link title
              <Input
                maxLength={200}
                value={ref.title ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    references: draft.references.map((r, j) =>
                      j === i ? { ...r, title: e.target.value } : r,
                    ),
                  })
                }
              />
            </label>
            <label className="grid gap-1 text-xs">
              URL
              <Input
                type="url"
                required
                maxLength={2048}
                value={ref.url}
                disabled={disabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    references: draft.references.map((r, j) =>
                      j === i ? { ...r, url: e.target.value } : r,
                    ),
                  })
                }
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Remove reference ${i + 1}`}
              onClick={() =>
                setDraft({
                  ...draft,
                  references: draft.references.filter((_, j) => j !== i),
                })
              }
            >
              <X size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || draft.references.length >= 20}
          onClick={() =>
            setDraft({
              ...draft,
              references: [...draft.references, { url: "", title: "" }],
            })
          }
        >
          <Plus size={16} />
          Add reference
        </Button>
      </fieldset>
      {draft.version !== list.version && (
        <div role="status" className="text-sm rounded-xl bg-accent p-3">
          This list changed. Your draft is kept.{" "}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setDraft(load());
              setError("");
            }}
          >
            Use latest work details
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          aria-label="Cancel work details"
          onClick={close}
        >
          <X size={16} aria-hidden="true" /> Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={disabled}
          aria-label="Save work details"
        >
          <Check size={16} aria-hidden="true" />{" "}
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
