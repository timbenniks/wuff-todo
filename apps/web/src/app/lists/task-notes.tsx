"use client";
import { wuffCopy, wuffError } from "@/lib/copy";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  taskContentLimit,
  taskImageLimit,
  taskImagePath,
  type Task,
  type TodoList,
} from "@wuff/contracts";
import { TaskMarkdown } from "@/components/task-markdown";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
const Editor = dynamic(() => import("./task-note-editor"), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-4 text-sm">
      {wuffCopy.writingPaws}
    </p>
  ),
});
export type NoteDraft = { draft: string; original: string };
export function TaskNotes({
  task,
  userId,
  list,
  busy,
  change,
  drafts,
  onClose,
}: {
  task: Task;
  userId: string;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, NoteDraft>;
  onClose: () => void;
}) {
  const retained = drafts.get(task.id);
  const [draft, setDraft] = useState(retained?.draft ?? task.content),
    [original] = useState(retained?.original ?? task.content),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    changed = task.content !== original,
    disabled = busy || saving || uploading || list.archived,
    tooLong = draft.length > taskContentLimit;
  useEffect(() => {
    if (!list.archived || retained) drafts.set(task.id, { draft, original });
  }, [drafts, task.id, draft, original, list.archived, retained]);
  const uploadingRef = useRef(false);
  const uploadRetry = useRef<
    { digest: string; params: URLSearchParams } | undefined
  >(undefined);
  const currentList = useRef(list);
  currentList.current = list;
  async function upload(file: File) {
    if (disabled || uploadingRef.current) throw new Error("Upload busy");
    if (file.size > taskImageLimit) {
      setError("That’s a big pup! Choose an image up to 3 MiB.");
      throw new Error("Image too large");
    }
    uploadingRef.current = true;
    setUploading(true);
    setError("");
    try {
      const input = currentList.current;
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const params =
        uploadRetry.current?.digest === digest
          ? uploadRetry.current.params
          : new URLSearchParams({
              listId: input.id,
              taskId: task.id,
              version: String(input.version),
              operationId: crypto.randomUUID(),
            });
      uploadRetry.current = { digest, params };
      const response = await fetch(`/api/v1/attachments?${params}`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Wuff-User": userId,
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status < 500) uploadRetry.current = undefined;
        if (data.error?.code === "account_changed")
          window.location.replace("/lists");
        throw new Error(
          data.error?.message ??
            "Ruff patch! Your image wasn’t uploaded. Try again.",
        );
      }
      uploadRetry.current = undefined;
      return taskImagePath(data.image.id);
    } catch (error) {
      setError(
        error instanceof Error
          ? wuffError(error.message)
          : "Ruff patch! Your image wasn’t uploaded. Try again.",
      );
      throw error;
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }
  function close() {
    drafts.delete(task.id);
    onClose();
  }
  async function save() {
    if (disabled || tooLong || pending.current || uploadingRef.current) return;
    if (draft === task.content) {
      close();
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
        close();
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
    <div
      id={`notes-${task.id}`}
      className="task-notes w-full min-w-0 mt-1 rounded-xl border border-border bg-white overflow-hidden"
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape" && !busy && !saving && !uploading) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save();
        }
      }}
    >
      {list.archived && !retained ? (
        <div className="p-4">
          <TaskMarkdown content={task.content} />
        </div>
      ) : (
        <Editor
          value={draft}
          onChange={setDraft}
          disabled={disabled}
          onUpload={upload}
        />
      )}
      {uploading && (
        <p role="status" className="px-4 py-2 text-sm text-slate-500">
          {wuffCopy.uploadingImage}
        </p>
      )}
      {changed && (
        <div
          role="status"
          className="border-t border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <p>
            New de-tails arrived. Your draft is kept. Save your version or
            cancel to use the latest notes.
          </p>
          <details className="mt-2">
            <summary>Latest saved notes</summary>
            <TaskMarkdown content={task.content} />
          </details>
        </div>
      )}
      {list.archived && retained && (
        <p role="status" className="px-4 py-2 text-sm">
          This list is taking a paws. Your draft is kept until its owner
          restores it.
        </p>
      )}
      {(error || tooLong) && (
        <p role="alert" className="p-3 text-sm text-red-800">
          {tooLong
            ? "That’s a long tail! Keep notes to 16,000 characters or fewer."
            : error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 p-3 border-t border-border bg-[#f9fbfd]">
        {!list.archived && (
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
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || saving || uploading}
          onClick={close}
        >
          {list.archived && !retained ? "Close" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
