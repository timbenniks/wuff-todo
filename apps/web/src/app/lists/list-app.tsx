"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ListTodo, LogOut, Plus, Trash2 } from "lucide-react";
import type { ListOrder, ListSummary, TodoList } from "@wuff/contracts";
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
import { listPalette } from "@/lib/list-colors";
import { ListSettings } from "./list-settings";
import { TaskGroups } from "./task-groups";
import { SortableList, SortableItem } from "@/components/sortable";
import { mergeVisibleOrder } from "@/lib/reorder";
import { InlineName } from "./inline-name";

type PendingCreate = {
  id: string;
  title: string;
  operationId: string;
  status: "saving" | "failed";
};
type PendingWrite = {
  path: string;
  method: string;
  body: Record<string, unknown>;
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
    [selectedId, setSelectedId] = useState(initialList?.id ?? "");
  const [showArchive, setShowArchive] = useState(
    initialList?.archived ?? false,
  );
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
  const uncertainWrite = useRef<PendingWrite | null>(null);
  const [retryWrite, setRetryWrite] = useState<PendingWrite | null>(null);
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
              color: current.color,
              archived: current.archived,
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
        color: "blue" as const,
        description: "",
        archived: false,
        sections: [],
        tasks: [],
      };
      cache.write(preview);
      setSummaries((items) => [...items, preview]);
      chooseList(request.id);
      setCreating(false);
      setShowArchive(false);
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
          color: created.color,
          archived: created.archived,
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
    retry = false,
  ) {
    if (mutating.current) return false;
    if (uncertainWrite.current && !retry) {
      setError(
        "A previous change needs confirmation. Retry that request first, or keep the current state.",
      );
      return false;
    }
    const request =
      retry && uncertainWrite.current
        ? uncertainWrite.current
        : { path, method, body: { ...body, operationId: crypto.randomUUID() } };
    mutating.current = true;
    summaryEpoch.current++;
    if (typeof body.listId === "string") cache.supersede(body.listId);
    setBusy(true);
    setError("");
    try {
      const result = await api<TodoList>(
        request.path,
        request.method,
        request.body,
      );
      uncertainWrite.current = null;
      setRetryWrite(null);
      remember(result);
      return true;
    } catch (e) {
      const uncertain = !(e instanceof ApiError) || e.status >= 500;
      uncertainWrite.current = uncertain ? request : null;
      setRetryWrite(uncertain ? request : null);
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
  async function moveList(next: string[], before: string[]) {
    if (mutating.current) return false;
    mutating.current = true;
    setBusy(true);
    setError("");
    summaryEpoch.current++;
    try {
      const order = await api<ListOrder>("/api/v1/list-order");
      const ids = mergeVisibleOrder(order.listIds, before, next);
      if (!ids)
        throw new Error(
          "Your pack of lists changed. Try moving the list again.",
        );
      const saved = await api<ListOrder>("/api/v1/list-order", "PUT", {
        listIds: ids,
        version: order.version,
        operationId: crypto.randomUUID(),
      });
      const rank = new Map(saved.listIds.map((id, i) => [id, i]));
      setSummaries((items) =>
        [...items].sort(
          (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
        ),
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
      void liveRefresh.current?.notify();
    }
  }
  useEffect(() => {
    if (list) setShowArchive(list.archived);
  }, [list?.id, list?.archived]);
  const visibleLists = summaries.filter((s) => s.archived === showArchive);
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
            {showArchive ? "Archived lists" : "Your lists"}
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
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = !showArchive;
              setShowArchive(next);
              chooseList(summaries.find((s) => s.archived === next)?.id ?? "");
            }}
          >
            <Archive size={15} />
            {showArchive
              ? "Back to lists"
              : `Archive (${summaries.filter((s) => s.archived).length})`}
          </Button>
        </div>
        <SortableList
          items={visibleLists}
          disabled={busy || !!pendingCreate}
          onReorder={moveList}
        >
          <nav
            aria-label={showArchive ? "Archived lists" : "Lists"}
            className="grid gap-1"
          >
            {visibleLists.map((s) => (
              <SortableItem
                key={s.id}
                id={s.id}
                title={`list ${s.title}`}
                disabled={busy || !!pendingCreate}
              >
                {({ ref, style, handle }) => (
                  <div
                    ref={ref}
                    style={style}
                    className="flex items-center min-w-0 gap-1"
                  >
                    <button
                      onClick={() => chooseList(s.id)}
                      onPointerEnter={() => {
                        if (!cache.get(s.id)) void reload(s.id).catch(() => {});
                      }}
                      onFocus={() => {
                        if (!cache.get(s.id)) void reload(s.id).catch(() => {});
                      }}
                      aria-current={s.id === selectedId ? "page" : undefined}
                      className={`flex flex-1 min-w-0 items-center gap-3 text-left rounded-xl px-3 py-3 text-sm ${s.id === selectedId ? "shadow-sm font-semibold" : "hover:bg-white/60"}`}
                      style={{
                        background:
                          s.id === selectedId
                            ? listPalette[s.color].tint
                            : undefined,
                      }}
                    >
                      <ListTodo
                        size={17}
                        className="shrink-0"
                        style={{ color: listPalette[s.color].accent }}
                      />
                      <span className="truncate">{s.title}</span>
                      {s.id === pendingCreate?.id && (
                        <span className="text-xs text-slate-500">
                          {pendingCreate.status === "saving"
                            ? "Saving…"
                            : "Retry"}
                        </span>
                      )}
                    </button>
                    {handle}
                  </div>
                )}
              </SortableItem>
            ))}
          </nav>
        </SortableList>
        {showArchive && visibleLists.length === 0 && (
          <p className="text-sm text-slate-500 px-3 py-4">
            No lists taking a paws yet.
          </p>
        )}
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
              ? "Your pack is in sync · Live updates connected"
              : liveStatus === "connecting"
                ? "Fetching live updates. Regular refresh is active."
                : "A little paws in live updates. Reconnecting; regular refresh is active."}
          </p>
        )}
        <InvitationInbox initial={initialInvitations} onJoined={joinedList} />
        {readFailure && (
          <p role="status" className="text-sm text-slate-500 mb-4">
            {readFailure}
          </p>
        )}
        {(error || retryWrite) && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 text-red-800 px-4 py-3 mb-6 text-sm"
          >
            {error || "Ruff patch! We couldn’t confirm your previous change."}
            {retryWrite && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    change(
                      retryWrite.path,
                      retryWrite.method,
                      retryWrite.body,
                      true,
                    )
                  }
                >
                  Retry same request
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    uncertainWrite.current = null;
                    setRetryWrite(null);
                    setError("");
                    void liveRefresh.current?.notify();
                  }}
                >
                  Keep current state
                </Button>
              </div>
            )}
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
              {showArchive
                ? "No lists taking a paws."
                : "Small paws. Big plans."}
            </h1>
            <p className="text-slate-500 mb-7">
              {showArchive
                ? "Your lists can take a paws here until you need them again."
                : "Groceries, weekend plans, anything your pack needs to remember."}
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} />
              Create your first list
            </Button>
          </div>
        )}
        {list && (
          <>
            <div
              className="flex flex-wrap items-start gap-3 mb-6 rounded-2xl border p-5 [&>div:first-child]:flex-1 [&>div:first-child]:basis-full md:[&>div:first-child]:basis-40"
              style={{
                background: listPalette[list.color].tint,
                borderColor: listPalette[list.color].accent + "30",
              }}
            >
              <div className="min-w-0">
                <InlineName
                  key={list.id}
                  value={list.title}
                  heading="h1"
                  label="List name"
                  editLabel="Rename list"
                  editable={list.ownerId === userId && !isPending}
                  disabled={busy}
                  onSave={(title) =>
                    change(`/api/v1/lists/${list.id}`, "PATCH", {
                      listId: list.id,
                      version: list.version,
                      title,
                    })
                  }
                />
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
                <div className="flex items-center gap-1">
                  <ListSettings
                    key={list.id}
                    list={list}
                    busy={busy}
                    change={change}
                    retry={
                      retryWrite
                        ? () =>
                            change(
                              retryWrite.path,
                              retryWrite.method,
                              retryWrite.body,
                              true,
                            )
                        : undefined
                    }
                  />
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
                  <p role="status">Tucking your list into the pack…</p>
                ) : (
                  <div role="alert" className="grid gap-4 justify-items-start">
                    <p>
                      Ruff patch! We couldn’t confirm your list was saved. Retry
                      to check and finish the same request.
                    </p>
                    <Button disabled={busy} onClick={() => create()}>
                      Retry saving list
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {list.description && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 mb-8">
                    {list.description}
                  </p>
                )}
                <TaskGroups
                  key={list.id}
                  list={list}
                  userId={userId}
                  busy={busy}
                  change={change}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
