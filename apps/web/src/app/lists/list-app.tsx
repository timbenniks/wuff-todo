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

async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "Couldn’t save your change.");
  return data;
}
export function ListApp({
  userId,
  name,
  initialLists,
}: {
  userId: string;
  name: string;
  initialLists: ListSummary[];
}) {
  const [summaries, setSummaries] = useState(initialLists),
    [selectedId, setSelectedId] = useState(initialLists[0]?.id ?? "");
  const [list, setList] = useState<TodoList | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [creating, setCreating] = useState(false);
  const selected = useRef(selectedId);
  selected.current = selectedId;
  const reload = useCallback(async (id: string) => {
    const next = await api<TodoList>(`/api/v1/lists/${id}`);
    if (selected.current === id)
      setList((previous) =>
        previous?.id === next.id && previous.version > next.version
          ? previous
          : next,
      );
  }, []);
  useEffect(() => {
    setList(null);
    setError("");
    if (!selectedId) return;
    setLoading(true);
    reload(selectedId)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedId, reload]);
  useEffect(() => {
    const refresh = async () => {
      if (document.hidden) return;
      try {
        setSummaries(await api<ListSummary[]>("/api/v1/lists"));
        if (selected.current) await reload(selected.current);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn’t refresh your lists.",
        );
      }
    };
    const timer = setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  async function change(
    path: string,
    method: string,
    body: Record<string, unknown>,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await api<TodoList>(path, method, {
        ...body,
        operationId: crypto.randomUUID(),
      });
      if (selected.current === result.id) setList(result);
      setSummaries(await api<ListSummary[]>("/api/v1/lists"));
      return true;
    } catch (e) {
      setError((e as Error).message);
      if (selected.current) await reload(selected.current).catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  }
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
              const form = e.currentTarget;
              const title = String(new FormData(form).get("title"));
              setBusy(true);
              setError("");
              try {
                const created = await api<TodoList>("/api/v1/lists", "POST", {
                  title,
                  operationId: crypto.randomUUID(),
                });
                setSummaries(await api("/api/v1/lists"));
                setSelectedId(created.id);
                setCreating(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
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
              onClick={() => setSelectedId(s.id)}
              aria-current={s.id === selectedId ? "page" : undefined}
              className={`flex items-center gap-3 text-left rounded-xl px-3 py-3 text-sm ${s.id === selectedId ? "bg-white shadow-sm font-semibold" : "hover:bg-white/60"}`}
            >
              <ListTodo size={17} />
              <span className="truncate">{s.title}</span>
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
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-4xl font-bold break-words">{list.title}</h1>
              {list.ownerId === userId && (
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
                      setBusy(true);
                      try {
                        await api(`/api/v1/lists/${list.id}`, "DELETE", {
                          version: list.version,
                          operationId: crypto.randomUUID(),
                        });
                        const next = await api<ListSummary[]>("/api/v1/lists");
                        setSummaries(next);
                        setSelectedId(next[0]?.id ?? "");
                        setList(null);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-10">
              {list.tasks.filter((t) => !t.completed).length} things to do
            </p>
            <ul aria-label="Active tasks" className="divide-y divide-border">
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
                        const title = window.prompt("Task name", task.title);
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
      </main>
    </div>
  );
}
