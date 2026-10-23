"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskDetail, TodoList } from "@wuff/contracts";
import { ListTheme } from "@/components/list-theme";
import { listThemeVariables } from "@/lib/list-theme";
import { Button } from "@/components/ui/button";
import { Corgi } from "@/components/corgi";
import { ApiError } from "@/lib/api";
import { LiveRefreshQueue } from "@/lib/live-refresh";
import type { LiveLists } from "@/lib/live-types";
import { useActorApi } from "../../lists/actor-api";
import { LiveUpdates } from "../../lists/live-updates";
import { TaskDetailContent } from "./task-detail-content";

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
  const [retry, setRetry] = useState<Pending | null>(null);
  const pending = useRef<Pending | null>(null),
    writing = useRef(false),
    epoch = useRef(0),
    unavailable = useRef(false);
  const queue = useRef<LiveRefreshQueue | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
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
  return (
    <main
      className="task-detail task-page min-h-dvh mx-auto px-4 sm:px-8 py-5 sm:py-8"
      style={listThemeVariables(list.color)}
    >
      <ListTheme color={list.color} />
      {liveConfig && (
        <LiveUpdates
          config={liveConfig}
          userId={userId}
          onChange={() => void queue.current?.notify()}
          onStatus={() => {}}
        />
      )}
      <nav className="flex items-center justify-between mb-3 min-h-11">
        <a
          href={`/lists?listId=${list.id}`}
          className="text-sm text-primary underline"
        >
          ← {list.title}
        </a>
        <Corgi size={40} />
      </nav>
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
      <p
        role="status"
        className={busy || notice ? "feedback-toast" : "sr-only"}
      >
        {busy ? "Saving…" : notice}
      </p>
      <TaskDetailContent
        task={task}
        list={list}
        userId={userId}
        busy={busy}
        change={change}
        refresh={refresh}
        onNotice={setNotice}
        onError={setError}
      />
    </main>
  );
}
