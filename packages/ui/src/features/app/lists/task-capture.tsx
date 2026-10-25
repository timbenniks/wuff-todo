"use client";
import { containDialogFocus } from "../../components/dialog-focus";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { ListSummary, TodoList } from "@wuff/contracts";
import { Button } from "../../../button";
import { Input } from "../../../input";
import { NativeSelect } from "../../../native-select";
import type { ListChange } from "./list-settings";

export function TaskCapture({
  list,
  busy,
  change,
  error,
  retry,
  onCreated,
  destinations,
  destinationId = "",
  onDestinationChange,
  destinationLoading = false,
}: {
  list: TodoList | null;
  busy: boolean;
  change: ListChange;
  error: string;
  retry?: () => Promise<boolean>;
  onCreated: (title: string) => void;
  destinations?: ListSummary[];
  destinationId?: string;
  onDestinationChange?: (id: string) => void;
  destinationLoading?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const ownsRetry = useRef(false);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!retry && !saving) ownsRetry.current = false;
  }, [retry, saving]);
  useEffect(() => {
    if (!retry) setSection("");
  }, [list?.id]);
  if (list?.archived) return null;
  const locked = busy || saving;
  function finish() {
    onCreated(title.trim());
    setTitle("");
    setFailed(false);
    dialog.current?.close();
  }
  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="primary"
        className="task-capture-trigger"
        disabled={!!destinations && destinations.length === 0}
        onClick={() => {
          if (!retry) setFailed(false);
          dialog.current?.showModal();
          input.current?.focus();
        }}
      >
        <Plus size={18} aria-hidden="true" /> Add task
      </Button>
      <dialog
        onKeyDown={containDialogFocus}
        ref={dialog}
        className="task-capture-dialog"
        aria-labelledby="task-capture-title"
        onClose={() => trigger.current?.focus()}
        onCancel={(e) => {
          if (locked) e.preventDefault();
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="task-capture-title" className="text-xl font-bold">
            Add task
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close task capture"
            disabled={locked}
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </Button>
        </div>
        {!destinations && (
          <p className="text-sm text-muted-foreground mb-4 break-words">
            Adding to <strong>{list?.title}</strong>
          </p>
        )}
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              locked ||
              pending.current ||
              retry ||
              !list ||
              destinationLoading
            )
              return;
            if (!title.trim()) {
              setFailed(true);
              input.current?.focus();
              return;
            }
            pending.current = true;
            ownsRetry.current = true;
            setSaving(true);
            setFailed(false);
            try {
              const saved = await change("/api/v1/tasks", "POST", {
                listId: list.id,
                version: list.version,
                title: title.trim(),
                sectionId: section || null,
              });
              if (saved) finish();
              else setFailed(true);
            } catch {
              setFailed(true);
            } finally {
              pending.current = false;
              setSaving(false);
            }
          }}
        >
          <label className="grid gap-1 text-sm">
            Task name
            <Input
              ref={input}
              value={title}
              required
              maxLength={300}
              readOnly={locked || !!retry}
              onChange={(e) => {
                setTitle(e.target.value);
                setFailed(false);
              }}
            />
          </label>
          {destinations && (
            <label className="grid gap-1 text-sm">
              Destination list
              <NativeSelect
                required
                value={destinationId}
                disabled={locked || !!retry}
                onChange={(e) => onDestinationChange?.(e.target.value)}
              >
                <option value="">Choose a list</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {destinationLoading && (
            <p role="status" className="text-sm">
              Loading list details…
            </p>
          )}
          {destinations && destinationId && !list && !destinationLoading && (
            <Button
              type="button"
              variant="outline"
              disabled={locked || !!retry}
              onClick={() => onDestinationChange?.(destinationId)}
            >
              Retry list details
            </Button>
          )}
          {!!list?.sections.length && (
            <label className="grid gap-1 text-sm">
              Section
              <NativeSelect
                value={section}
                disabled={locked || !!retry}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">No section</option>
                {list.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {(failed ||
            retry ||
            (destinations && error && !list && destinationId)) && (
            <p role="alert" className="text-sm">
              {retry
                ? "The previous change needs confirmation. Retry it before adding another task."
                : error ||
                  "Task wasn’t added. Your draft is kept. Enter a task name and try again."}
            </p>
          )}
          {retry && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={async () => {
                if (pending.current) return;
                const completesCapture = ownsRetry.current;
                pending.current = true;
                setSaving(true);
                try {
                  if (await retry()) {
                    if (completesCapture) finish();
                  }
                } catch {
                  // The existing request remains the only valid retry.
                } finally {
                  pending.current = false;
                  setSaving(false);
                }
              }}
            >
              Retry same request
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={
                locked ||
                !!retry ||
                !title.trim() ||
                !list ||
                destinationLoading
              }
            >
              {locked ? "Saving…" : "Add task"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={locked}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {destinations
              ? "Closing keeps your draft while this view stays open."
              : "Closing keeps your draft while this list stays open."}
          </p>
        </form>
      </dialog>
    </>
  );
}
