"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FileText, Pencil } from "lucide-react";
import { taskContentLimit, type Task, type TodoList } from "@wuff/contracts";
import { needsMarkdownSource } from "@/lib/task-markdown";
import { TaskMarkdown } from "@/components/task-markdown";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
const Editor = dynamic(() => import("./task-note-editor"), {
  ssr: false,
  loading: () => <p role="status">Fetching your writing paws…</p>,
});
export type NoteDraft = {
  open: boolean;
  editing: boolean;
  mode: "visual" | "source";
  draft: string;
  original: string;
};
export function TaskNotes({
  task,
  list,
  busy,
  change,
  drafts,
}: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, NoteDraft>;
}) {
  const retained = drafts.get(task.id);
  const [open, setOpen] = useState(retained?.open ?? false),
    [editing, setEditing] = useState(retained?.editing ?? false),
    [mode, setMode] = useState<"visual" | "source">(retained?.mode ?? "visual"),
    [draft, setDraft] = useState(retained?.draft ?? task.content),
    [original, setOriginal] = useState(retained?.original ?? task.content),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    summary = useRef<HTMLElement>(null),
    editButton = useRef<HTMLButtonElement>(null);
  const changed = task.content !== original,
    disabled = busy || saving || list.archived;
  useEffect(() => {
    if (editing) drafts.set(task.id, { open, editing, mode, draft, original });
    else drafts.delete(task.id);
  }, [drafts, task.id, open, editing, mode, draft, original]);
  const tooLong = draft.length > taskContentLimit;
  useEffect(() => {
    if (editing && list.archived)
      setError(
        "This list is taking a paws. Your draft is kept; its owner must restore the list before you can save.",
      );
  }, [editing, list.archived]);
  function begin() {
    setDraft(task.content);
    setOriginal(task.content);
    setMode(needsMarkdownSource(task.content) ? "source" : "visual");
    setError(
      needsMarkdownSource(task.content)
        ? "These de-tails use HTML, images or extended syntax. Markdown mode keeps the original content safe and intact."
        : "",
    );
    setEditing(true);
  }
  function finish() {
    setEditing(false);
    setError("");
    requestAnimationFrame(() => editButton.current?.focus());
  }
  async function save() {
    if (disabled || tooLong || pending.current) return;
    if (draft === task.content) {
      finish();
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      if (
        await change("/api/v1/tasks", "PATCH", {
          listId: list.id,
          version: list.version,
          taskId: task.id,
          content: draft,
        })
      )
        finish();
      else
        setError(
          "Ruff patch! Your notes weren’t confirmed saved. Your draft is kept; check the message above before retrying.",
        );
    } catch {
      setError(
        "Ruff patch! Your notes weren’t saved. Your draft is kept. Try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <details
      className="task-notes basis-full min-w-0 ml-9"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        ref={summary}
        className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 py-1 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <FileText size={14} aria-hidden="true" />
        {task.content || list.archived ? "Task notes" : "Add notes"}
        <span className="sr-only"> for {task.title}</span>
      </summary>
      {open && (
        <div className="mt-2 rounded-2xl border border-border bg-[#f9fbfd] p-4 sm:p-5 min-w-0">
          {editing ? (
            <div
              className="grid gap-3"
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Escape" && !disabled) {
                  e.preventDefault();
                  e.stopPropagation();
                  finish();
                }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void save();
                }
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  A little more de-tail
                </span>
                <div
                  role="group"
                  aria-label="Editor mode"
                  className="flex gap-1"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "visual" ? "outline" : "ghost"}
                    aria-pressed={mode === "visual"}
                    onClick={() => {
                      if (needsMarkdownSource(draft))
                        setError(
                          "These de-tails use HTML, images or extended syntax. Keep editing in Markdown to retain them.",
                        );
                      else setMode("visual");
                    }}
                    disabled={disabled}
                  >
                    Rich text
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "source" ? "outline" : "ghost"}
                    aria-pressed={mode === "source"}
                    onClick={() => setMode("source")}
                    disabled={disabled}
                  >
                    Markdown
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Markdown keeps every de-tail portable. Rich text may normalize
                formatting; use Markdown for syntax outside the toolbar. Images
                stay as text until uploads arrive.
              </p>
              {mode === "visual" ? (
                <Editor
                  value={draft}
                  onChange={setDraft}
                  disabled={disabled}
                  onUnsupported={() => {
                    setMode("source");
                    setError(
                      "These de-tails use formatting the rich text editor cannot preserve. Keep editing in Markdown to retain every word.",
                    );
                  }}
                />
              ) : (
                <>
                  <label className="text-xs font-semibold">
                    Markdown source
                    <textarea
                      aria-label="Markdown source"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      readOnly={disabled}
                      rows={10}
                      className="mt-1 w-full font-mono text-sm"
                      autoFocus
                    />
                  </label>
                  <div className="rounded-xl border border-border bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-3">
                      Preview
                    </p>
                    <TaskMarkdown content={draft} />
                  </div>
                </>
              )}
              {changed && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
                >
                  <p>
                    New de-tails arrived while you were editing. Your draft is
                    kept. Compare the latest notes below, then save your version
                    or cancel to use theirs.
                  </p>
                  <details className="mt-2">
                    <summary>Latest saved notes</summary>
                    <TaskMarkdown content={task.content} />
                  </details>
                </div>
              )}
              {(error || tooLong) && (
                <p role="alert" className="text-sm text-red-800">
                  {tooLong
                    ? "That’s a long tail! Keep notes to 16,000 characters or fewer."
                    : error}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || tooLong}
                  onClick={() => void save()}
                >
                  {saving
                    ? "Saving your de-tails…"
                    : changed
                      ? "Save my notes"
                      : "Save notes"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || saving}
                  onClick={finish}
                >
                  Cancel
                </Button>
                <span className="text-xs text-slate-500 ml-auto">
                  {draft.length.toLocaleString()} / 16,000
                </span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {task.content ? (
                <TaskMarkdown content={task.content} />
              ) : (
                <p className="text-sm text-slate-500">
                  More de-tails? Add a note, a link, or a few steps for your
                  pack.
                </p>
              )}
              {!list.archived && (
                <Button
                  ref={editButton}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="justify-self-start"
                  onClick={begin}
                >
                  <Pencil size={14} />
                  {task.content ? "Edit notes" : "Add notes"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
