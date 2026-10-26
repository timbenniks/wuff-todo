"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../../../features/api";
import { Button } from "../../../../../button";
import type { AgentTaskState, Task, TodoList } from "@wuff/contracts";
import { useActorApi } from "../../../../../features/actor-api";
export function AgentTask({
  task,
  list,
  userId,
  refresh,
}: {
  task: Task;
  list: TodoList;
  userId: string;
  refresh: () => Promise<void>;
}) {
  const api = useActorApi();
  const [state, setState] = useState<AgentTaskState>({
    conversation: null,
    runs: [],
  });
  const [message, setMessage] = useState(""),
    [mode, setMode] = useState<"plan" | "agent">("plan");
  const [providerRunId, setProviderRunId] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [watch, setWatch] = useState(false);
  const [activity, setActivity] = useState<Record<string, unknown>[]>([]);
  const pending = useRef<Record<string, unknown> | null>(null),
    cursor = useRef<string | undefined>(undefined);
  const owner = userId === list.ownerId;
  const current = state.runs.at(-1);
  const running =
    current &&
    !["FINISHED", "ERROR", "CANCELLED", "EXPIRED"].includes(current.status);
  useEffect(() => {
    let alive = true,
      loading = false;
    async function load() {
      if (loading || pending.current) return;
      loading = true;
      try {
        const result = await api<AgentTaskState>(
          `/api/v1/agents?taskId=${task.id}`,
          "GET",
          undefined,
          userId,
        );
        if (alive) setState(result);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        loading = false;
      }
    }
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [task.id, userId, list.version]);
  useEffect(() => {
    cursor.current = undefined;
    setActivity([]);
  }, [current?.id]);
  useEffect(() => {
    if (!watch || !current?.providerRunId) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await api<{
          events: Record<string, unknown>[];
          cursor: string | null;
          expired?: boolean;
        }>(
          `/api/v1/agents?taskId=${task.id}&activity=${current!.id}${cursor.current ? `&cursor=${encodeURIComponent(cursor.current)}` : ""}`,
          "GET",
          undefined,
          userId,
        );
        if (!alive) return;
        if (result.expired) {
          setError(
            "Live activity expired. The run’s final reply remains in the conversation.",
          );
          setWatch(false);
          return;
        }
        cursor.current = result.cursor ?? undefined;
        setActivity((old) => [...old, ...result.events].slice(-300));
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setWatch(false);
          return;
        }
      }
      if (alive) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [watch, current?.id, current?.providerRunId, task.id, userId]);
  async function send(action: string, retry = false) {
    if (pending.current && !retry) return;
    setBusy(true);
    setError("");
    const body = retry
      ? pending.current!
      : {
          action,
          taskId: task.id,
          listId: list.id,
          version: list.version,
          operationId: crypto.randomUUID(),
          ...(action === "recover"
            ? { runId: current!.id, providerRunId, confirmed: true }
            : action === "cancel"
              ? { runId: current!.id }
              : { message, mode, confirmed: true }),
        };
    pending.current = body;
    try {
      const result = await api<AgentTaskState>(
        "/api/v1/agents",
        "POST",
        body,
        userId,
      );
      pending.current = null;
      setState(result);
      if (action !== "cancel") setMessage("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  if (list.mode !== "work") return null;

  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 sm:p-5 grid gap-3 min-w-0"
      data-task-busy={busy || !!pending.current || undefined}
      data-unsaved={
        !!message ||
        (!!providerRunId && current?.status === "uncertain") ||
        undefined
      }
    >
      <h2 className="text-lg font-bold">Coding companion</h2>
      <p className="text-sm text-muted-foreground">
        Plan a ticket with Cursor, then ask it to build. Runs use your Cursor
        account’s paid usage.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {owner && (
        <a
          className="text-primary underline"
          href={`/connections?listId=${list.id}#cursor`}
        >
          Environment and secrets
        </a>
      )}
      {state.conversation && (
        <a
          className="text-primary underline"
          href={state.conversation.url}
          target="_blank"
          rel="noreferrer"
        >
          Open conversation in Cursor
        </a>
      )}
      <div
        className="grid gap-3 max-h-96 overflow-auto"
        aria-label="Agent conversation"
      >
        {state.runs.map((run) => (
          <article
            key={run.id}
            className="rounded-lg border border-border p-3 grid gap-2"
          >
            <p className="text-sm font-semibold">
              {run.mode === "plan" ? "Plan" : "Build"} · {run.status}
            </p>
            <details>
              <summary className="cursor-pointer">Your instructions</summary>
              <p className="whitespace-pre-wrap break-words text-sm">
                {run.prompt}
              </p>
            </details>
            {run.result && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {run.result}
              </p>
            )}
            {run.pullRequestUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline break-all"
              >
                Review pull request #{url.split("/").at(-1)}
              </a>
            ))}
            {run.error && (
              <p className="text-sm text-destructive">
                {run.status === "uncertain"
                  ? "Message delivery is uncertain. Inspect the conversation in Cursor before taking further action."
                  : "This run needs attention. Check Cursor and the connection."}
              </p>
            )}
          </article>
        ))}
      </div>
      {owner && (
        <>
          {current?.status === "uncertain" && (
            <div className="grid gap-2">
              <label className="grid gap-1 text-sm">
                Run ID verified in Cursor
                <input
                  className="rounded-lg border border-border bg-background p-2"
                  value={providerRunId}
                  onChange={(e) => setProviderRunId(e.target.value)}
                  placeholder="run-…"
                />
              </label>
              <Button
                disabled={busy || !/^run-[a-f0-9-]{36}$/i.test(providerRunId)}
                onClick={() => send("recover")}
              >
                Recover this existing run
              </Button>
            </div>
          )}
          {pending.current ? (
            <Button disabled={busy} onClick={() => send("", true)}>
              Retry previous request safely
            </Button>
          ) : (
            <>
              <label className="grid gap-1 text-sm">
                Instructions or follow-up
                <textarea
                  className="w-full min-h-24 rounded-lg border border-border bg-background p-3"
                  maxLength={16000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Clarify the requirements, or ask for a change…"
                />
              </label>
              <label className="grid gap-1 text-sm">
                What should Cursor do?
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="rounded-lg border border-border bg-background p-2"
                >
                  <option value="plan">Discuss and plan</option>
                  <option value="agent">Implement and open a PR</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    !!running ||
                    list.archived ||
                    (!!state.conversation && !message.trim())
                  }
                  onClick={() =>
                    send(state.conversation ? "message" : "launch")
                  }
                >
                  {state.conversation ? "Send to Cursor" : "Start Cursor"} ·
                  paid run
                </Button>
                {running && (
                  <Button disabled={busy} onClick={() => send("cancel")}>
                    Stop run
                  </Button>
                )}
              </div>
            </>
          )}
          {current?.providerRunId && (
            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={watch}
                onChange={(e) => setWatch(e.target.checked)}
              />
              Watch live activity
            </label>
          )}
          {watch && (
            <div
              className="max-h-72 overflow-auto rounded-lg border border-border p-3 text-sm"
              aria-label="Live agent activity"
            >
              {!activity.length && <p>Waiting for activity…</p>}
              {activity.map((item, i) => (
                <div key={i} className="whitespace-pre-wrap break-words mb-2">
                  {item.type === "thinking" ? (
                    <details>
                      <summary>Thinking</summary>
                      {String(item.text)}
                    </details>
                  ) : (
                    String(
                      item.text ?? `${item.name ?? ""} ${item.status ?? ""}`,
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
