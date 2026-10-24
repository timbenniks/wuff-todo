"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { DashboardTask, ListSummary, TodoList } from "@wuff/contracts";
import { ApiError } from "../../api";
import { useActorApi } from "../../actor-api";
import type { ListChange } from "./list-settings";

type HomeTask = Pick<DashboardTask, "id" | "title" | "path" | "list">;
type Completion = { task: HomeTask; completed: boolean };

export function useHomeTasks({
  lists,
  busy,
  change,
  retry,
  blocked,
  invalidate,
  refresh,
}: {
  lists: ListSummary[];
  busy: boolean;
  change: ListChange;
  retry?: () => Promise<boolean>;
  blocked: RefObject<boolean>;
  invalidate: () => void;
  refresh: () => Promise<void>;
}) {
  const api = useActorApi();
  const [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    effect = useRef<Completion | null>(null);
  const [recent, setRecent] = useState<HomeTask[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [destination, setDestination] = useState<TodoList | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const destinationEpoch = useRef(0);
  const [detailList, setDetailList] = useState<TodoList | null>(null),
    [detailId, setDetailId] = useState<string | null>(null);
  const detailEpoch = useRef(0);
  const currentDestination = useRef(destinationId),
    currentDetail = useRef(detailList?.id);
  currentDestination.current = destinationId;
  currentDetail.current = detailList?.id;
  const activeLists = lists.filter(
    (l) => !l.archived && !l.id.startsWith("pending-"),
  );
  const authorized = useRef(activeLists);
  authorized.current = activeLists;
  useEffect(() => {
    const allowed = new Set(activeLists.map((l) => l.id));
    setRecent((old) => old.filter((t) => allowed.has(t.list.id)));
    if (destinationId && !allowed.has(destinationId)) {
      destinationEpoch.current++;
      setDestination(null);
      setDestinationId("");
      setDestinationLoading(false);
    }
    if (detailList && !allowed.has(detailList.id)) {
      detailEpoch.current++;
      setDetailList(null);
      setDetailId(null);
    }
  }, [lists]);
  useEffect(
    () => () => {
      destinationEpoch.current++;
      detailEpoch.current++;
    },
    [],
  );
  function allowed(id: string) {
    return authorized.current.some((l) => l.id === id);
  }
  async function selectDestination(id: string) {
    const epoch = ++destinationEpoch.current;
    setDestinationId(id);
    setDestination(null);
    setError("");
    if (!id) {
      setDestinationLoading(false);
      return;
    }
    setDestinationLoading(true);
    try {
      const next = await api<TodoList>(`/api/v1/lists/${id}`);
      if (epoch === destinationEpoch.current && allowed(id) && !next.archived)
        setDestination(next);
    } catch (e) {
      if (epoch === destinationEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === destinationEpoch.current) setDestinationLoading(false);
    }
  }
  async function openTask(task: HomeTask) {
    const epoch = ++detailEpoch.current;
    setError("");
    try {
      const next = await api<TodoList>(`/api/v1/lists/${task.list.id}`);
      if (epoch === detailEpoch.current && allowed(next.id) && !next.archived) {
        setDetailList(next);
        setDetailId(task.id);
      }
    } catch (e) {
      if (epoch === detailEpoch.current) setError((e as Error).message);
    }
  }
  const lostAccess = (e: unknown) =>
    e instanceof ApiError && [401, 403, 404].includes(e.status);
  async function refreshDetail() {
    const id = currentDetail.current;
    if (!id) return;
    try {
      const next = await api<TodoList>(`/api/v1/lists/${id}`);
      if (currentDetail.current === id && allowed(id))
        setDetailList((old) =>
          old?.id === id && old.version > next.version ? old : next,
        );
    } catch (e) {
      if (lostAccess(e)) {
        setDetailList(null);
        setDetailId(null);
      }
      setError((e as Error).message);
    }
  }
  // Version changes (including MCP/collaborator updates) refresh an open drawer.
  useEffect(() => {
    if (!pending.current) void refreshDetail();
  }, [lists]);
  function settle() {
    const result = effect.current;
    if (result && allowed(result.task.list.id))
      setRecent((old) =>
        result.completed
          ? [result.task, ...old.filter((t) => t.id !== result.task.id)].slice(
              0,
              100,
            )
          : old.filter((t) => t.id !== result.task.id),
      );
    effect.current = null;
  }
  async function syncSnapshot(id: string) {
    try {
      const next = await api<TodoList>(`/api/v1/lists/${id}`);
      if (!allowed(id) || next.archived) return;
      if (currentDestination.current === id) setDestination(next);
      if (currentDetail.current === id) setDetailList(next);
    } catch (e) {
      if (lostAccess(e)) {
        if (currentDestination.current === id) setDestination(null);
        if (currentDetail.current === id) {
          setDetailList(null);
          setDetailId(null);
        }
        setRecent((old) => old.filter((task) => task.list.id !== id));
      }
      // A follow-up read failure cannot turn an acknowledged write into a failure.
    }
  }
  const write: ListChange = async (path, method, body) => {
    if (pending.current || busy || retry || blocked.current) return false;
    const id = String(body.listId ?? "");
    if (!allowed(id)) {
      setError("Choose an available list before saving.");
      return false;
    }
    pending.current = true;
    setWorking(true);
    setError("");
    blocked.current = true;
    invalidate();
    let ok = false;
    try {
      const latest = await api<TodoList>(`/api/v1/lists/${id}`);
      if (latest.archived)
        throw Error("This list is archived. Restore it before making changes.");
      const task = latest.tasks.find((t) => t.id === body.taskId);
      effect.current =
        task && typeof body.completed === "boolean"
          ? {
              task: {
                id: task.id,
                title: task.title,
                path: task.path,
                list: {
                  id: latest.id,
                  title: latest.title,
                  ownerId: latest.ownerId,
                  color: latest.color,
                  shared: latest.shared,
                  archived: latest.archived,
                  version: latest.version,
                },
              },
              completed: body.completed,
            }
          : null;
      const directCompletion =
        typeof body.completed === "boolean" &&
        Object.keys(body).every((key) =>
          ["listId", "version", "taskId", "completed"].includes(key),
        );
      ok = await change(
        path,
        method,
        method === "POST" || directCompletion
          ? { ...body, version: latest.version }
          : body,
      );
      if (ok) settle();
      await syncSnapshot(id);
    } catch (e) {
      setError((e as Error).message);
      effect.current = null;
    } finally {
      blocked.current = false;
      await refresh();
      pending.current = false;
      setWorking(false);
    }
    return ok;
  };
  async function toggle(task: HomeTask, completed: boolean) {
    // Direct completion reads the current revision; concurrent changes still conflict.
    return write("/api/v1/tasks", "PATCH", {
      listId: task.list.id,
      version: task.list.version,
      taskId: task.id,
      completed,
    });
  }
  async function repeat() {
    if (!retry || pending.current || busy) return false;
    pending.current = true;
    setWorking(true);
    blocked.current = true;
    invalidate();
    let ok = false;
    try {
      ok = await retry();
      if (ok) {
        const id = effect.current?.task.list.id ?? currentDestination.current;
        settle();
        if (id) await syncSnapshot(id);
      }
    } finally {
      blocked.current = false;
      await refresh();
      pending.current = false;
      setWorking(false);
    }
    return ok;
  }
  return {
    activeLists,
    working,
    error,
    recent,
    destinationId,
    destination,
    destinationLoading,
    selectDestination,
    openTask,
    detailList,
    detailId,
    setDetailId,
    refreshDetail,
    write,
    toggle,
    repeat,
  };
}
