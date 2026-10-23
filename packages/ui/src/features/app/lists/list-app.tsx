"use client";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "../../../input-group";

import { wuffCopy, wuffError } from "../../lib/copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, House, ListTodo, LogOut, Plus, Trash2 } from "lucide-react";
import type { ListOrder, ListSummary, TodoList } from "@wuff/contracts";
import { Button } from "../../../button";
import { Corgi } from "../../components/corgi";
import { useRuntime } from "../../runtime";
import { ApiError } from "../../api";
import { InvitationInbox, SharingDialog } from "./sharing";
import type { IncomingInvitation } from "@wuff/contracts";
import { ListCache } from "../../lib/list-cache";

import { useActorApi } from "../../actor-api";
import { LiveUpdates } from "../../live-updates";
import type { LiveLists } from "@wuff/ui/live-types";
import { LiveRefreshQueue } from "@wuff/client/live-refresh";
import { ListTheme } from "../../components/list-theme";
import { listThemeVariables } from "../../lib/list-theme";
import { ListSettings } from "./list-settings";
import { TaskGroups } from "./task-groups";
import { HomeDashboard } from "./home-dashboard";
import { SidebarLists } from "./sidebar-lists";
import { mergeVisibleOrder } from "../../lib/reorder";
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
  const startupHome = useRef(!initialList);
  const api = useActorApi();
  const runtime = useRuntime();
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationTrigger = useRef<HTMLButtonElement>(null);
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
  useEffect(() => () => cache.clear(), [cache]);
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
            wuffError(
              error instanceof Error
                ? error.message
                : "Couldn’t load your list.",
            ),
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
  function chooseList(id: string, navigate = true) {
    startupHome.current = false;
    if (!id) setShowArchive(false);
    if (navigate) {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set("listId", id);
        url.searchParams.delete("home");
      } else {
        url.searchParams.delete("listId");
        url.searchParams.set("home", "1");
      }
      if (url.href !== window.location.href)
        window.history.pushState(null, "", url.pathname + url.search);
    }
    selected.current = id;
    setSelectedId(id);
    const cached = cache.get(id);
    setList(cached);
    setLoading(!!id && !cached);
    setError("");
    setReadFailure("");
  }
  useEffect(() => {
    if (
      selectedId &&
      summaries.some((item) => item.id === selectedId) &&
      !selectedId.startsWith("pending-")
    )
      try {
        localStorage.setItem(`wuff:last-list:${userId}`, selectedId);
      } catch {}
  }, [selectedId, userId]);
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
    window.addEventListener("online", focused);
    document.addEventListener("visibilitychange", focused);
    return () => {
      active = false;
      queue.stop();
      if (liveRefresh.current === queue) liveRefresh.current = null;
      clearInterval(timer);
      window.removeEventListener("focus", focused);
      window.removeEventListener("online", focused);
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
              ...item,
              id: current.id,
              title: current.title,
              ownerId: current.ownerId,
              shared: current.shared,
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
        shared: false,
        version: 0,
        color: "blue" as const,
        mode: "simple" as const,
        assignees: [],
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
          shared: created.shared,
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
        "Paws a moment! A previous change needs confirmation. Retry that request first, or keep the current state.",
      );
      return false;
    }
    const request =
      retry && uncertainWrite.current
        ? uncertainWrite.current
        : {
            path,
            method,
            body: JSON.parse(
              JSON.stringify({ ...body, operationId: crypto.randomUUID() }),
            ),
          };
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
      setError(wuffError((e as Error).message));
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
  const [sidebarRetry, setSidebarRetry] = useState<Record<
    string,
    unknown
  > | null>(null);
  function applyOrder(saved: ListOrder) {
    const rank = new Map(saved.listIds.map((id, i) => [id, i]));
    const parents = new Map(
      (saved.nesting ?? []).map((entry) => [entry.listId, entry.parentListId]),
    );
    summaryEpoch.current++;
    setSummaries((items) =>
      items
        .map((item) => ({
          ...item,
          parentListId: parents.get(item.id) ?? null,
          favorite: (saved.favoriteListIds ?? []).includes(item.id),
          sidebarCollapsed: (saved.collapsedListIds ?? []).includes(item.id),
        }))
        .sort(
          (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
        ),
    );
  }
  async function saveSidebar(
    change: ((order: ListOrder) => Record<string, unknown>) | null,
  ) {
    if (mutating.current || (sidebarRetry && change)) return false;
    mutating.current = true;
    setBusy(true);
    setError("");
    summaryEpoch.current++;
    let request: Record<string, unknown> | undefined;
    try {
      if (!change && sidebarRetry) request = sidebarRetry;
      else {
        const order = await api<ListOrder>("/api/v1/list-order");
        request = {
          ...order,
          ...change!(order),
          operationId: crypto.randomUUID(),
        };
      }
      const saved = await api<ListOrder>("/api/v1/list-order", "PUT", request);
      setSidebarRetry(null);
      applyOrder(saved);
      return true;
    } catch (e) {
      setError(wuffError((e as Error).message));
      setSidebarRetry(
        request && !(e instanceof ApiError && e.status < 500) ? request : null,
      );
      return false;
    } finally {
      mutating.current = false;
      setBusy(false);
      void liveRefresh.current?.notify();
    }
  }
  async function moveList(next: string[], before: string[]) {
    return saveSidebar((order) => {
      const ids = mergeVisibleOrder(order.listIds, before, next);
      const parents = new Map(
        (order.nesting ?? []).map((entry) => [
          entry.listId,
          entry.parentListId,
        ]),
      );
      // A concurrent reparent must not turn a sibling reorder into a different move.
      if (
        !ids ||
        before.some(
          (id) =>
            (parents.get(id) ?? null) !==
            (summariesRef.current.find((list) => list.id === id)
              ?.parentListId ?? null),
        )
      )
        throw new Error(
          "Your pack of lists changed. Try moving the list again.",
        );
      return { listIds: ids };
    });
  }
  useEffect(() => {
    if (list) setShowArchive(list.archived);
  }, [list?.id, list?.archived]);
  useEffect(() => {
    const restore = () => {
      const requested = new URL(window.location.href).searchParams.get(
        "listId",
      );
      const id = summariesRef.current.find((s) => s.id === requested)?.id;
      chooseList(id ?? "", false);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [cache]);
  const visibleLists = summaries.filter((s) => s.archived === showArchive);
  return (
    <div
      className="workspace-shell bg-background text-foreground"
      style={listThemeVariables(list?.color ?? "blue")}
    >
      <ListTheme color={list?.color ?? "blue"} />
      <a className="skip-link" href="#list-content">
        Skip to content
      </a>
      {(liveConfig || runtime.native) && (
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
      <aside className="workspace-sidebar bg-sidebar border-b md:border-b-0 md:border-r border-border px-5 py-4 md:py-6 flex flex-col">
        <div className="flex gap-3 items-center md:mb-8">
          <Corgi size={48} />
          <span className="wordmark text-xl font-bold">Wuff Todo</span>
          <Button
            ref={navigationTrigger}
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden ml-auto"
            aria-label="Choose a list"
            title="Choose a list"
            aria-expanded={navigationOpen}
            aria-controls="pack-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            <ListTodo size={20} />
          </Button>
        </div>
        <div
          id="pack-navigation"
          className={`${navigationOpen ? "flex" : "hidden"} md:flex flex-1 min-h-0 flex-col pt-4 md:pt-0`}
          onKeyDown={(e) => {
            if (e.key === "Escape" && navigationOpen) {
              setNavigationOpen(false);
              navigationTrigger.current?.focus();
            }
          }}
        >
          <Button
            type="button"
            variant="ghost"
            className="justify-start mb-5"
            aria-current={!selectedId && !showArchive ? "page" : undefined}
            onClick={() => {
              chooseList("");
              setShowArchive(false);
              setNavigationOpen(false);
            }}
          >
            <House size={18} />
            Home
          </Button>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              {showArchive ? wuffCopy.archiveHeading : wuffCopy.listsHeading}
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
          <div className="workspace-list-nav">
            {creating && (
              <form
                className="mb-4 grid gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await create(
                    String(new FormData(e.currentTarget).get("title")),
                  );
                }}
              >
                <label
                  htmlFor="new-list-name"
                  className="text-xs text-muted-foreground"
                >
                  List name
                </label>
                <InputGroup>
                  <InputGroupInput
                    id="new-list-name"
                    name="title"
                    aria-label="List name"
                    placeholder={wuffCopy.listPlaceholder}
                    maxLength={300}
                    required
                    autoFocus
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      aria-label="Create list"
                      title="Create list"
                    >
                      <Plus size={18} aria-hidden="true" /> Create
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </form>
            )}
            <SidebarLists
              lists={summaries}
              archived={showArchive}
              selectedId={selectedId}
              disabled={busy || !!pendingCreate || !!sidebarRetry}
              pending={pendingCreate}
              choose={(id) => {
                chooseList(id);
                if (navigationOpen) {
                  setNavigationOpen(false);
                  requestAnimationFrame(() =>
                    navigationTrigger.current?.focus(),
                  );
                }
              }}
              preload={(id) => {
                if (!cache.get(id)) void reload(id).catch(() => {});
              }}
              reorder={moveList}
              toggle={(id, collapsed) =>
                saveSidebar((order) => ({
                  collapsedListIds: !collapsed
                    ? (order.collapsedListIds ?? []).filter(
                        (value) => value !== id,
                      )
                    : [
                        ...(order.collapsedListIds ?? []).filter(
                          (value) => value !== id,
                        ),
                        id,
                      ],
                }))
              }
            />
            {sidebarRetry && (
              <div role="alert" className="grid gap-2 py-3 text-sm">
                <p>
                  The sidebar change wasn’t confirmed. Retry the same request to
                  check it.
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => saveSidebar(null)}
                >
                  Retry sidebar change
                </Button>
              </div>
            )}
            {showArchive && visibleLists.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4">
                No lists taking a paws yet.
              </p>
            )}
          </div>
          <div className="workspace-footer mt-6 md:mt-auto pt-4 md:pt-8 text-sm flex flex-wrap md:block items-center justify-between gap-1">
            <div className="flex flex-wrap md:grid items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  const next = !showArchive;
                  setShowArchive(next);
                  chooseList(
                    summaries.find((s) => s.archived === next)?.id ?? "",
                  );
                }}
              >
                <Archive size={15} />
                {showArchive
                  ? "Back to lists"
                  : `Archive (${summaries.filter((s) => s.archived).length})`}
              </Button>

              <a
                href={runtime.webOrigin + "/settings"}
                className="flex min-h-11 items-center px-3 py-2 text-primary hover:underline"
              >
                Settings
              </a>
            </div>
            {runtime.githubConsent && (
              <Button
                className="my-2"
                disabled={busy}
                onClick={() =>
                  void runtime.githubConsent!().catch((error) =>
                    setError(error.message),
                  )
                }
              >
                Enable GitHub changes
              </Button>
            )}
            <div className="flex items-center justify-between px-3 md:pt-3 md:border-t border-border md:mt-3">
              <span className="hidden md:inline truncate">{name}</span>
              <Button
                aria-label="Sign out"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  cache.clear();
                  await runtime.signOut();
                }}
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </aside>
      <main
        id="list-content"
        tabIndex={-1}
        className="list-content workspace-main"
      >
        {(liveConfig || runtime.native) && (
          <p role="status" className="text-xs text-muted-foreground mb-4">
            {liveStatus === "live"
              ? wuffCopy.liveConnected
              : liveStatus === "connecting"
                ? wuffCopy.connectingLive
                : wuffCopy.reconnectingLive}
          </p>
        )}
        <InvitationInbox initial={initialInvitations} onJoined={joinedList} />
        {readFailure && (
          <p role="status" className="text-sm text-muted-foreground mb-4">
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
          <p role="status" className="text-muted-foreground">
            {wuffCopy.fetchingList}
          </p>
        )}
        {!selectedId && !showArchive && (
          <HomeDashboard
            userId={userId}
            revision={summaries
              .map(
                (item) =>
                  `${item.id}:${item.version}:${item.favorite}:${item.archived}`,
              )
              .join("|")}
            initialEntry={startupHome.current}
            chooseList={(id) => chooseList(id)}
            createList={() => {
              setCreating(true);
              setNavigationOpen(true);
            }}
          />
        )}
        {!selectedId && showArchive && (
          <div className="py-12">
            <Corgi size={88} />
            <h1 className="text-4xl font-bold mt-7 mb-3">
              {showArchive
                ? "No lists taking a paws."
                : "Small paws. Big plans."}
            </h1>
            <p className="text-muted-foreground mb-7">
              {showArchive
                ? "Your lists can take a paws here until you need them again."
                : "Groceries, weekend plans, anything your pack needs to remember."}
            </p>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={18} />
              Create your first list
            </Button>
          </div>
        )}
        {list && (
          <>
            <div className="list-heading flex flex-wrap items-start gap-4 mb-4 rounded-2xl border border-border bg-accent p-5">
              <div className="min-w-0 flex-1 basis-full sm:basis-60">
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
                  <p className="text-xs text-muted-foreground mt-2">
                    {list.ownerId === userId
                      ? "Your list · Pack leader"
                      : "Shared with your pack"}
                    {list.mode === "work" && " · Work"}
                  </p>
                )}
                {list.description && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed mt-3">
                    {list.description}
                  </p>
                )}
              </div>
              <div className="list-management flex flex-wrap items-center gap-2">
                {!isPending && (
                  <SharingDialog
                    key={`sharing:${list.id}`}
                    list={list}
                    userId={userId}
                    disabled={busy}
                    onChanged={sharingChanged}
                  />
                )}
                {!isPending && (
                  <ListSettings
                    key={`settings:${list.id}`}
                    list={list}
                    userId={userId}
                    busy={busy}
                    change={change}
                    sidebar={{
                      lists: summaries,
                      disabled: busy || !!pendingCreate || !!sidebarRetry,
                      error,
                      retry: sidebarRetry ? () => saveSidebar(null) : undefined,
                      favorite: (id, enabled) =>
                        saveSidebar((order) => ({
                          favoriteListIds: [
                            ...(order.favoriteListIds ?? []).filter(
                              (value) => value !== id,
                            ),
                            ...(enabled ? [id] : []),
                          ],
                        })),
                      move: (id, parentId) =>
                        saveSidebar((order) => ({
                          nesting: [
                            ...(order.nesting ?? []).filter(
                              (entry) => entry.listId !== id,
                            ),
                            ...(parentId
                              ? [{ listId: id, parentListId: parentId }]
                              : []),
                          ],
                          collapsedListIds: (
                            order.collapsedListIds ?? []
                          ).filter((value) => value !== parentId),
                        })),
                    }}
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
                )}
                {list.ownerId === userId && !isPending && (
                  <div className="contents">
                    <Button
                      variant="danger"
                      className="list-delete"
                      disabled={busy}
                      aria-label="Delete list"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Paws before deleting: delete “${list.title}” and all its tasks for everyone? This cannot be undone.`,
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
                          setError(wuffError((e as Error).message));
                        } finally {
                          mutating.current = false;
                          setBusy(false);
                          void liveRefresh.current?.flush();
                        }
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" /> Delete list
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {isPending ? (
              <div className="mt-6 text-sm text-muted-foreground">
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
                <TaskGroups
                  key={list.id}
                  list={list}
                  userId={userId}
                  busy={busy}
                  change={change}
                  error={error}
                  refresh={() => reload(list.id)}
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
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
