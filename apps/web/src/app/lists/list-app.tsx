"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListTodo,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { ListSummary, Task, TodoList } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { Corgi } from "@/components/corgi";
import { authClient } from "@/lib/auth/client";
import { ApiError } from "@/lib/api";
import { InvitationInbox, SharingDialog } from "./sharing";
import type { IncomingInvitation } from "@wuff/contracts";
import { ListCache } from "@/lib/list-cache";

import { useActorApi } from "./actor-api";
import { LiveUpdates } from "./live-updates";
import type { LiveLists } from "@/lib/live-types";
import { LiveRefreshQueue } from "@/lib/live-refresh";

type PendingCreate = {
  id: string;
  title: string;
  operationId: string;
  status: "saving" | "failed";
};

export function ListApp({
  userId,
  name,
  initialLists,
  initialList,
  initialInvitations,
  liveConfig,
}: {
  userId: string;
  name: string;
  initialLists: ListSummary[];
  initialList: TodoList | null;
  initialInvitations: IncomingInvitation[];
  liveConfig: LiveLists | null;
}) {
  const api = useActorApi();
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [readFailure, setReadFailure] = useState("");
  const liveRefresh = useRef<LiveRefreshQueue | null>(null);
  const [summaries, setSummaries] = useState(initialLists),
    [selectedId, setSelectedId] = useState(initialLists[0]?.id ?? "");
  const [list, setList] = useState<TodoList | null>(initialList),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [creating, setCreating] = useState(false);
  const [cache] = useState(() => new ListCache(initialList));
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(
    null,
  );
  const pending = useRef<PendingCreate | null>(null);
  const mutating = useRef(false);
  const skipSelectionRead = useRef(initialList?.id ?? "");
  const summaryEpoch = useRef(0);
  const summariesRef = useRef(summaries);
  summariesRef.current = summaries;
  const selected = useRef(selectedId);
  selected.current = selectedId;
  const readError = useCallback(
    (id: string, error: unknown) => {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        summaryEpoch.current++;
        cache.clear();
        pending.current = null;
        setPendingCreate(null);
        setList(null);
        setSummaries([]);
        selected.current = "";
        setSelectedId("");
      } else if (error instanceof ApiError && error.status === 404) {
        cache.forget(id);
        setSummaries((items) => items.filter((item) => item.id !== id));
        if (selected.current === id) {
          setList(null);
          selected.current = "";
          setSelectedId("");
        }
      }
      if (
        selected.current === id ||
        (error instanceof ApiError && [401, 403, 404].includes(error.status))
      )
        if (error instanceof ApiError && [429, 503].includes(error.status))
          setReadFailure(error.message);
        else
          setError(
            error instanceof Error ? error.message : "Couldn’t load your list.",
          );
    },
    [cache],
  );
  const reload = useCallback(
    async (id: string) => {
      if (pending.current?.id === id) return;
      try {
        const next = await cache.load(id, () =>
          api<TodoList>(`/api/v1/lists/${id}`),
        );
        if (selected.current === id) {
          setList(next);
          setReadFailure("");
        }
      } catch (error) {
        readError(id, error);
        throw error;
      }
    },
    [cache, readError, api],
  );
  function chooseList(id: string) {
    selected.current = id;
    setSelectedId(id);
    const cached = cache.get(id);
    setList(cached);
    setLoading(!!id && !cached);
    setError("");
    setReadFailure("");
  }
  useEffect(() => {
    const skipRead = skipSelectionRead.current === selectedId;
    skipSelectionRead.current = "";
    const cached = cache.get(selectedId);
    setList(cached);
    if (
      !selectedId ||
      pending.current?.id === selectedId ||
      (skipRead && cached)
    ) {
      setLoading(false);
      return;
    }
    setLoading(!cached);
    reload(selectedId)
      .catch(() => {})
      .finally(() => {
        if (selected.current === selectedId) setLoading(false);
      });
  }, [selectedId, reload, cache]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!active || document.hidden || mutating.current) return;
      const epoch = summaryEpoch.current;
      try {
        await Promise.all([
          api<ListSummary[]>("/api/v1/lists").then((next) => {
            if (!active || mutating.current || summaryEpoch.current !== epoch)
              return;
            // Preserve the visibly pending create until its own request settles.
            const pendingList =
              pending.current && cache.get(pending.current.id);
            setSummaries(pendingList ? [...next, pendingList] : next);
            for (const current of summariesRef.current)
              if (
                current.id !== pending.current?.id &&
                !next.some((s) => s.id === current.id)
              )
                cache.forget(current.id);
            if (
              selected.current &&
              selected.current !== pending.current?.id &&
              !next.some((s) => s.id === selected.current)
            )
              chooseList("");
          }),
          selected.current ? reload(selected.current) : Promise.resolve(),
        ]);
      } catch (e) {
        readError(selected.current, e);
      }
    };
    const queue = new LiveRefreshQueue(
      refresh,
      () => mutating.current || document.hidden,
    );
    liveRefresh.current = queue;
    const focused = () => {
      void queue.notify();
    };
    const timer = setInterval(focused, 10_000);
    window.addEventListener("focus", focused);
    document.addEventListener("visibilitychange", focused);
    return () => {
      active = false;
      queue.stop();
      if (liveRefresh.current === queue) liveRefresh.current = null;
      clearInterval(timer);
      window.removeEventListener("focus", focused);
      document.removeEventListener("visibilitychange", focused);
    };
  }, [reload, cache, readError, api]);
  function remember(result: TodoList) {
    const current = cache.write(result);
    if (selected.current === current.id) setList(current);
    setSummaries((items) =>
      items.map((item) =>
        item.id === current.id
          ? {
              id: current.id,
              title: current.title,
              ownerId: current.ownerId,
              version: current.version,
            }
          : item,
      ),
    );
  }
  async function create(title?: string) {
    if (mutating.current) return;
    let request = pending.current;
    if (!request) {
      const operationId = crypto.randomUUID();
      request = {
        id: `pending-${operationId}`,
        operationId,
        title: (title ?? "").trim(),
        status: "saving",
      };
      if (!request.title) return;
      const preview = {
        id: request.id,
        title: request.title,
        ownerId: userId,
        version: 0,
        tasks: [],
      };
      cache.write(preview);
      setSummaries((items) => [...items, preview]);
      chooseList(request.id);
      setCreating(false);
    }
    request = { ...request, status: "saving" };
    pending.current = request;
    setPendingCreate(request);
    mutating.current = true;
    summaryEpoch.current++;
    setBusy(true);
    setError("");
    try {
      const created = await api<TodoList>("/api/v1/lists", "POST", {
        title: request.title,
        operationId: request.operationId,
      });
      cache.forget(request.id);
      cache.write(created);
      setSummaries((items) => [
        ...items.filter(
          (item) => item.id !== request.id && item.id !== created.id,
        ),
        {
          id: created.id,
          title: created.title,
          ownerId: created.ownerId,
          version: created.version,
        },
      ]);
      pending.current = null;
      setPendingCreate(null);
      if (selected.current === request.id) {
        skipSelectionRead.current = created.id;
        chooseList(created.id);
      }
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        readError(request.id, error);
        return;
      }
      const failed = { ...request, status: "failed" as const };
      pending.current = failed;
      setPendingCreate(failed);
    } finally {
      mutating.current = false;
      setBusy(false);
      void liveRefresh.current?.flush();
    }
  }
  async function change(
    path: string,
    method: string,
    body: Record<string, unknown>,
  ) {
    if (mutating.current) return false;
    mutating.current = true;
    summaryEpoch.current++;
    if (typeof body.listId === "string") cache.supersede(body.listId);
    setBusy(true);
    setError("");
    try {
      const result = await api<TodoList>(path, method, {
        ...body,
        operationId: crypto.randomUUID(),
      });
      remember(result);
      return true;
    } catch (e) {
      setError((e as Error).message);
      if (selected.current) await reload(selected.current).catch(() => {});
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
      void liveRefresh.current?.flush();
    }
  }
  async function sharingChanged(id: string, left = false) {
    summaryEpoch.current++;
    cache.supersede(id);
    if (left) {
      cache.forget(id);
      setSummaries((items) => items.filter((item) => item.id !== id));
      if (selected.current === id) chooseList("");
    } else await reload(id).catch(() => {});
  }
  async function joinedList(id: string) {
    summaryEpoch.current++;
    const next = await api<ListSummary[]>("/api/v1/lists");
    setSummaries(next);
    chooseList(id);
  }
  const isPending = list?.id === pendingCreate?.id;
  async function move(task: Task, direction: number) {
    if (!list) return;
    const ids = list.tasks.filter((t) => !t.completed).map((t) => t.id),
      index = ids.indexOf(task.id),
      target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await change("/api/v1/tasks", "PUT", {
      listId: list.id,
      version: list.version,
      taskIds: ids,
    });
  }
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      {liveConfig && (
        <LiveUpdates
          config={liveConfig}
          userId={userId}
          onChange={() => {
            summaryEpoch.current++;
            void liveRefresh.current?.notify();
          }}
          onStatus={setLiveStatus}
        />
      )}
      <aside className="bg-[#edf4fa] border-b md:border-b-0 md:border-r border-border px-5 py-4 md:py-6 md:min-h-dvh flex flex-col">
        <div className="flex gap-3 items-center mb-4 md:mb-8">
          <Corgi size={48} />
          <span className="wordmark text-xl font-bold">Wuff Todo</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
            Your lists
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Create list"
            disabled={busy || !!pendingCreate}
            onClick={() => setCreating((v) => !v)}
          >
            <Plus size={18} />
          </Button>
        </div>
        {creating && (
          <form
            className="mb-4 grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await create(String(new FormData(e.currentTarget).get("title")));
            }}
          >
            <input
              name="title"
              aria-label="List name"
              placeholder="List name"
              maxLength={300}
              required
              autoFocus
            />
            <Button size="sm" disabled={busy}>
              Create list
            </Button>
          </form>
        )}
        <nav aria-label="Lists" className="flex flex-wrap md:grid gap-1">
          {summaries.map((s) => (
            <button
              key={s.id}
              onClick={() => chooseList(s.id)}
              onPointerEnter={() => {
                if (!cache.get(s.id)) void reload(s.id).catch(() => {});
              }}
              onFocus={() => {
                if (!cache.get(s.id)) void reload(s.id).catch(() => {});
              }}
              aria-current={s.id === selectedId ? "page" : undefined}
              className={`flex items-center gap-3 text-left rounded-xl px-3 py-3 text-sm ${s.id === selectedId ? "bg-white shadow-sm font-semibold" : "hover:bg-white/60"}`}
            >
              <ListTodo size={17} />
              <span className="truncate">{s.title}</span>
              {s.id === pendingCreate?.id && (
                <span className="text-xs text-slate-500">
                  {pendingCreate.status === "saving" ? "Saving…" : "Retry"}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-3 md:mt-auto pt-2 md:pt-8 text-sm flex md:block items-center justify-between">
          <a
            href="/connections"
            className="block px-3 py-2 text-primary hover:underline"
          >
            Connected AI clients
          </a>
          <div className="flex items-center justify-between px-3 md:pt-3 md:border-t border-border md:mt-3">
            <span className="hidden md:inline truncate">{name}</span>
            <Button
              aria-label="Sign out"
              variant="ghost"
              size="icon"
              onClick={async () => {
                cache.clear();
                await authClient.signOut();
                window.location.assign("/sign-in");
              }}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>
      <main className="px-6 py-10 md:px-16 md:py-16 max-w-4xl w-full mx-auto">
        {liveConfig && (
          <p role="status" className="text-xs text-slate-500 mb-4">
            {liveStatus === "live"
              ? "Live updates connected"
              : liveStatus === "connecting"
                ? "Connecting live updates. Regular refresh is active."
                : "Live updates reconnecting. Regular refresh is active."}
          </p>
        )}
        <InvitationInbox initial={initialInvitations} onJoined={joinedList} />
        {readFailure && (
          <p role="status" className="text-sm text-slate-500 mb-4">
            {readFailure}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 text-red-800 px-4 py-3 mb-6 text-sm"
          >
            {error}
          </div>
        )}
        {loading && (
          <p role="status" className="text-slate-500">
            Fetching your list…
          </p>
        )}
        {!selectedId && (
          <div className="py-12">
            <Corgi size={88} />
            <h1 className="text-4xl font-bold mt-7 mb-3">
              A little room for your day.
            </h1>
            <p className="text-slate-500 mb-7">
              Groceries, weekend plans, things you don’t want to forget.
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} />
              Create your first list
            </Button>
          </div>
        )}
        {list && (
          <>
            <div className="flex flex-wrap items-start gap-2 mb-2 [&>div:first-child]:flex-1 [&>div:first-child]:basis-40">
              <div className="min-w-0">
                <h1 className="text-4xl font-bold break-words">{list.title}</h1>
                {!isPending && (
                  <p className="text-xs text-slate-500 mt-2">
                    {list.ownerId === userId ? "Your list" : "Shared with you"}
                  </p>
                )}
              </div>
              {!isPending && (
                <SharingDialog
                  key={list.id}
                  list={list}
                  userId={userId}
                  disabled={busy}
                  onChanged={sharingChanged}
                />
              )}
              {list.ownerId === userId && !isPending && (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label="Rename list"
                    onClick={async () => {
                      const title = window.prompt("List name", list.title);
                      if (title?.trim())
                        await change(`/api/v1/lists/${list.id}`, "PATCH", {
                          title,
                          version: list.version,
                        });
                    }}
                  >
                    <Pencil size={17} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label="Delete list"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Delete “${list.title}” and all its tasks for everyone? This cannot be undone.`,
                        )
                      )
                        return;
                      if (mutating.current) return;
                      setBusy(true);
                      mutating.current = true;
                      summaryEpoch.current++;
                      cache.supersede(list.id);
                      try {
                        await api(`/api/v1/lists/${list.id}`, "DELETE", {
                          version: list.version,
                          operationId: crypto.randomUUID(),
                        });
                        cache.forget(list.id);
                        const next = summariesRef.current.filter(
                          (item) => item.id !== list.id,
                        );
                        setSummaries(next);
                        if (selected.current === list.id)
                          chooseList(next[0]?.id ?? "");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        mutating.current = false;
                        setBusy(false);
                        void liveRefresh.current?.flush();
                      }
                    }}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              )}
            </div>
            {isPending ? (
              <div className="mt-6 text-sm text-slate-500">
                {pendingCreate?.status === "saving" ? (
                  <p role="status">Saving your list…</p>
                ) : (
                  <div role="alert" className="grid gap-4 justify-items-start">
                    <p>
                      We couldn’t confirm your list was saved. Retry to check
                      and finish the same request.
                    </p>
                    <Button disabled={busy} onClick={() => create()}>
                      Retry saving list
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-10">
                  {list.tasks.filter((t) => !t.completed).length} things to do
                </p>
                <ul
                  aria-label="Active tasks"
                  className="divide-y divide-border"
                >
                  {list.tasks
                    .filter((t) => !t.completed)
                    .map((task, i, active) => (
                      <li
                        key={task.id}
                        className="group flex items-center gap-3 py-3"
                      >
                        <button
                          aria-label={`Complete ${task.title}`}
                          disabled={busy}
                          className="h-6 w-6 shrink-0 rounded-full border-2 border-[#aabdcf] hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
                          onClick={() =>
                            change("/api/v1/tasks", "PATCH", {
                              listId: list.id,
                              taskId: task.id,
                              version: list.version,
                              completed: true,
                            })
                          }
                        />
                        <button
                          disabled={busy}
                          className="text-left min-w-0 flex-1 py-2 break-words"
                          aria-label={`Edit ${task.title}`}
                          onClick={() => {
                            const title = window.prompt(
                              "Task name",
                              task.title,
                            );
                            if (title?.trim())
                              change("/api/v1/tasks", "PATCH", {
                                listId: list.id,
                                taskId: task.id,
                                version: list.version,
                                title,
                              });
                          }}
                        >
                          {task.title}
                        </button>
                        <div className="flex">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Move ${task.title} up`}
                            disabled={busy || i === 0}
                            onClick={() => move(task, -1)}
                          >
                            <ArrowUp size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Move ${task.title} down`}
                            disabled={busy || i === active.length - 1}
                            onClick={() => move(task, 1)}
                          >
                            <ArrowDown size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${task.title}`}
                            disabled={busy}
                            onClick={() =>
                              change("/api/v1/tasks", "DELETE", {
                                listId: list.id,
                                taskId: task.id,
                                version: list.version,
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
                <form
                  className="flex gap-2 mt-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    if (
                      await change("/api/v1/tasks", "POST", {
                        listId: list.id,
                        version: list.version,
                        title: String(new FormData(form).get("title")),
                      })
                    )
                      form.reset();
                  }}
                >
                  <input
                    name="title"
                    aria-label="New task"
                    placeholder="Add a little thing to do…"
                    maxLength={300}
                    required
                    className="flex-1"
                  />
                  <Button disabled={busy} type="submit" aria-label="Add task">
                    <Plus size={20} />
                  </Button>
                </form>
                <details className="mt-10">
                  <summary className="text-sm text-slate-500 py-3">
                    Completed ({list.tasks.filter((t) => t.completed).length})
                  </summary>
                  <ul>
                    {list.tasks
                      .filter((t) => t.completed)
                      .map((task) => (
                        <li
                          key={task.id}
                          className="flex gap-3 items-center py-3 text-slate-500"
                        >
                          <button
                            aria-label={`Reopen ${task.title}`}
                            disabled={busy}
                            onClick={() =>
                              change("/api/v1/tasks", "PATCH", {
                                listId: list.id,
                                taskId: task.id,
                                version: list.version,
                                completed: false,
                              })
                            }
                            className="rounded-full bg-primary text-white w-6 h-6 flex items-center justify-center"
                          >
                            <Check size={15} />
                          </button>
                          <span className="line-through break-words">
                            {task.title}
                          </span>
                        </li>
                      ))}
                  </ul>
                </details>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
