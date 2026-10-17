"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import type { TaskDetail, TodoList } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { Corgi } from "@/components/corgi";
import { TaskMarkdown } from "@/components/task-markdown";
import { ApiError } from "@/lib/api";
import { LiveRefreshQueue } from "@/lib/live-refresh";
import type { LiveLists } from "@/lib/live-types";
import { useCalendarDay } from "@/lib/use-calendar-day";
import { useActorApi } from "../../lists/actor-api";
import { InlineName } from "../../lists/inline-name";
import { LiveUpdates } from "../../lists/live-updates";
import { TaskNotes, type NoteDraft } from "../../lists/task-notes";
import {
  TaskDueDate,
  DueDateBadge,
  type DueDateDraft,
} from "../../lists/task-due-date";
import { Subtasks } from "../../lists/task-row";
import { WorkMetadata } from "./work-metadata";

type Pending = { path: string; method: string; body: Record<string, unknown> };
export function TaskDetailApp({
  initial,
  userId,
  liveConfig,
}: {
  initial: TaskDetail;
  userId: string;
  liveConfig: LiveLists | null;
}) {
  const api = useActorApi();
  const [list, setList] = useState<TodoList | null>(initial.list);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [notesOpen, setNotesOpen] = useState(false),
    [dateOpen, setDateOpen] = useState(false);
  const noteTrigger = useRef<HTMLButtonElement>(null),
    dateTrigger = useRef<HTMLButtonElement>(null);
  const [retry, setRetry] = useState<Pending | null>(null);
  const pending = useRef<Pending | null>(null),
    writing = useRef(false),
    epoch = useRef(0),
    unavailable = useRef(false);
  const notes = useRef(new Map<string, NoteDraft>()),
    dates = useRef(new Map<string, DueDateDraft>()),
    children = useRef(new Map<string, string>());
  const queue = useRef<LiveRefreshQueue | null>(null);
  const today = useCalendarDay();
  const refresh = useCallback(async () => {
    if (unavailable.current) return;
    const started = epoch.current;
    try {
      const next = await api<TaskDetail>(`/api/v1/tasks/${initial.task.id}`);
      if (started === epoch.current && !writing.current) setList(next.list);
      else void queue.current?.notify();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        unavailable.current = true;
        setList(null);
        queue.current?.stop();
      }
      setError(e instanceof Error ? e.message : "Couldn’t refresh this task.");
    }
  }, [api, initial.task.id]);
  useEffect(() => {
    const current = new LiveRefreshQueue(refresh, () => writing.current);
    queue.current = current;
    const tick = () => {
      if (document.visibilityState === "visible") void current.notify();
    };
    const timer = setInterval(tick, 10_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      current.stop();
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);
  async function change(
    path: string,
    method: string,
    body: Record<string, unknown>,
    isRetry = false,
  ) {
    if (writing.current || unavailable.current) return false;
    if (pending.current && !isRetry) {
      setError(
        "A previous request needs confirmation. Retry it before making another change.",
      );
      return false;
    }
    const request =
      isRetry && pending.current
        ? pending.current
        : { path, method, body: { ...body, operationId: crypto.randomUUID() } };
    writing.current = true;
    epoch.current++;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await api<TodoList>(
        request.path,
        request.method,
        request.body,
      );
      pending.current = null;
      setRetry(null);
      setList(next);
      setNotice("Saved.");
      return true;
    } catch (e) {
      const uncertain = !(e instanceof ApiError) || e.status >= 500;
      pending.current = uncertain ? request : null;
      setRetry(pending.current);
      setError(
        e instanceof Error ? e.message : "Couldn’t save. Your draft is kept.",
      );
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        unavailable.current = true;
        setList(null);
        queue.current?.stop();
      } else void queue.current?.notify();
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
      void queue.current?.flush();
    }
  }
  const task = list?.tasks.find((t) => t.id === initial.task.id);
  if (!list || !task)
    return (
      <main className="max-w-xl mx-auto p-6 py-16">
        <h1 className="text-3xl font-bold">This task is unavailable.</h1>
        <p className="my-4">
          It may have been removed, or your access changed.
        </p>
        <a href="/lists" className="underline text-primary">
          Back to lists
        </a>
      </main>
    );
  const body = { listId: list.id, version: list.version, taskId: task.id };
  return (
    <main className="max-w-3xl mx-auto px-5 sm:px-8 py-6 sm:py-10">
      {liveConfig && (
        <LiveUpdates
          config={liveConfig}
          userId={userId}
          onChange={() => void queue.current?.notify()}
          onStatus={() => {}}
        />
      )}
      <nav className="flex items-center justify-between mb-8">
        <a
          href={`/lists?listId=${list.id}`}
          className="text-sm text-primary underline"
        >
          ← {list.title}
        </a>
        <Corgi />
      </nav>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <span className="font-semibold tracking-wide">{task.key}</span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copy task link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                new URL(task.path, window.location.origin).href,
              );
              setNotice("Task link copied.");
            } catch {
              setError("Couldn’t copy. Copy this page’s address instead.");
            }
          }}
        >
          <Copy size={14} />
        </Button>
        {list.archived && <span>Archived · Read only</span>}
      </div>
      <InlineName
        value={task.title}
        label="Task name"
        editLabel="Rename task"
        heading="h1"
        editable={!list.archived}
        disabled={busy}
        onSave={(title) => change("/api/v1/tasks", "PATCH", { ...body, title })}
      />
      {error && (
        <p
          role="alert"
          className="my-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {retry && (
        <Button
          disabled={busy}
          onClick={() => change(retry.path, retry.method, retry.body, true)}
        >
          Retry previous change
        </Button>
      )}
      <p role="status" className="text-sm text-slate-500 min-h-6 mt-3">
        {busy ? "Saving…" : notice}
      </p>
      <div className="flex flex-wrap gap-3 items-center my-5">
        <Button
          disabled={busy || list.archived}
          variant="ghost"
          onClick={() =>
            change("/api/v1/tasks", "PATCH", {
              ...body,
              completed: !task.completed,
            })
          }
        >
          <Check size={16} />
          {task.completed ? "Reopen task" : "Complete task"}
        </Button>
        <DueDateBadge task={task} today={today} />
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setDateOpen(!dateOpen)}
          ref={dateTrigger}
          aria-expanded={dateOpen}
        >
          Due date
        </Button>
      </div>
      {dateOpen && (
        <div className="mb-6">
          <TaskDueDate
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={dates.current}
            onClose={() => {
              setDateOpen(false);
              requestAnimationFrame(() => dateTrigger.current?.focus());
            }}
          />
        </div>
      )}
      <div className="grid gap-6">
        <WorkMetadata task={task} list={list} busy={busy} change={change} />
        <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Notes</h2>
            {!notesOpen && !list.archived && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit task notes"
                ref={noteTrigger}
                disabled={busy}
                onClick={() => setNotesOpen(true)}
              >
                <Pencil size={16} />
              </Button>
            )}
          </div>
          {notesOpen ? (
            <TaskNotes
              task={task}
              list={list}
              busy={busy}
              change={change}
              drafts={notes.current}
              userId={userId}
              onClose={() => {
                setNotesOpen(false);
                requestAnimationFrame(() => noteTrigger.current?.focus());
              }}
            />
          ) : task.content ? (
            <TaskMarkdown content={task.content} />
          ) : (
            <p className="text-sm text-slate-500">
              A little context for your next step.
            </p>
          )}
        </section>
        {!task.parentTaskId && (
          <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 min-w-0">
            <h2 className="text-lg font-bold mb-4">Subtasks</h2>
            <Subtasks
              focusNewTask={false}
              parent={task}
              items={list.tasks.filter((t) => t.parentTaskId === task.id)}
              list={list}
              userId={userId}
              busy={busy}
              change={change}
              drafts={notes.current}
              subtaskDrafts={children.current}
              dueDrafts={dates.current}
              today={today}
            />
          </section>
        )}
        {task.parentTaskId && (
          <a
            href={`/tasks/${task.parentTaskId}`}
            className="text-sm text-primary underline"
          >
            Open parent task
          </a>
        )}
      </div>
    </main>
  );
}
