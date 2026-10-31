"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  CalendarDays,
  Check,
  Settings2,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  defaultDashboardSettings,
  type Dashboard,
  type DashboardPreferences,
  type DashboardSettings,
  type DashboardSection,
  type ListSummary,
  type DashboardTask,
} from "@wuff/contracts";
import { useActorApi } from "../../../../features/actor-api";
import { ApiError } from "../../../../features/api";
import { useCalendarDay } from "../../lib/use-calendar-day";
import { formatDueDate } from "../../lib/due-date";
import { listPalette } from "../../lib/list-colors";
import { Button } from "../../../../button";
import { containDialogFocus } from "../../../../features/components/dialog-focus";
import { ListBrowser } from "./list-browser";
import { TaskCapture } from "./task-capture";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { useHomeTasks } from "./use-home-tasks";
import type { ListChange } from "./list-settings";
import { NativeSelect } from "../../../../native-select";

const labels = {
  today: "Today",
  upcoming: "Coming up",
  favorites: "Favorites",
};
export function HomeDashboard({
  userId,
  name,
  revision,
  chooseList,
  createList,
  initialEntry,
  lists = [],
  busy = false,
  change,
  taskError = "",
  retryTask,
  favorite,
  catalogError,
  retryCatalog,
}: {
  userId: string;
  name: string;
  revision: string;
  chooseList: (id: string) => void;
  createList: () => void;
  initialEntry: boolean;
  lists?: ListSummary[];
  busy?: boolean;
  change: ListChange;
  taskError?: string;
  retryTask?: () => Promise<boolean>;
  favorite: (id: string, enabled: boolean) => Promise<boolean>;
  catalogError: string;
  retryCatalog: () => void;
}) {
  const viewName = "Overview";
  const api = useActorApi(),
    today = useCalendarDay();
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [limit, setLimit] = useState(5);
  const [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<DashboardSettings>(
      defaultDashboardSettings,
    ),
    [draftVersion, setDraftVersion] = useState(0);
  const [saveError, setSaveError] = useState(""),
    [retry, setRetry] = useState<null | {
      version: number;
      settings: DashboardSettings;
      operationId: string;
    }>(null);
  const epoch = useRef(0),
    startup = useRef(initialEntry),
    blocked = useRef(false),
    dialog = useRef<HTMLDialogElement>(null);
  const previousRevision = useRef(revision);
  const callback = useRef(chooseList);
  callback.current = chooseList;
  const refresh = useCallback(async () => {
    if (!today || document.hidden || blocked.current) return;
    const current = ++epoch.current;
    try {
      const next = await api<Dashboard>(
        `/api/v1/dashboard?today=${today}&limit=${limit}`,
      );
      if (epoch.current !== current) return;
      setData(next);
      setError("");
      if (startup.current) {
        startup.current = false;
        if (
          !new URL(window.location.href).searchParams.has("home") &&
          next.preferences.settings.startPage === "last_list"
        ) {
          let last = "";
          try {
            last = localStorage.getItem(`wuff:last-list:${userId}`) ?? "";
          } catch {}
          // Reauthorize the remembered ID before showing it; no task data is stored locally.
          if (last) {
            const lists =
              await api<import("@wuff/contracts").ListSummary[]>(
                "/api/v1/lists",
              );
            if (
              epoch.current === current &&
              lists.some((list) => list.id === last && !list.archived)
            )
              callback.current(last);
          }
        }
      }
    } catch (e) {
      if (epoch.current === current) {
        setData(null);
        setError((e as Error).message);
      }
    }
  }, [api, today, limit, userId]);
  const tasks = useHomeTasks({
    lists,
    busy: busy || saving,
    change,
    retry: retryTask,
    blocked,
    invalidate: () => {
      epoch.current++;
    },
    refresh,
  });
  const [captureNotice, setCaptureNotice] = useState<{
    title: string;
    listId: string;
    listTitle: string;
  } | null>(null);
  const locked = busy || saving || tasks.working;
  const canRecover = tasks.recent.filter((task) =>
    tasks.activeLists.some((list) => list.id === task.list.id),
  );
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const timer = setInterval(onFocus, 10000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      epoch.current++;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (previousRevision.current !== revision) {
      previousRevision.current = revision;
      void refresh();
    }
  }, [revision, refresh]);
  function customize() {
    if (!data || locked || retryTask || blocked.current) return;
    setDraft(structuredClone(data.preferences.settings));
    setDraftVersion(data.preferences.version);
    setSaveError("");
    dialog.current?.showModal();
  }
  async function save(exact = false) {
    if (saving || !data || blocked.current) return;
    const request = exact
      ? retry
      : {
          version: draftVersion,
          settings: draft,
          operationId: crypto.randomUUID(),
        };
    if (!request) return;
    setSaving(true);
    blocked.current = true;
    epoch.current++;
    setSaveError("");
    try {
      const saved = await api<DashboardPreferences>(
        "/api/v1/dashboard",
        "PUT",
        request,
      );
      setData((current) =>
        current ? { ...current, preferences: saved } : null,
      );
      setRetry(null);
      setNotice(`Your ${viewName} settings are saved.`);
      dialog.current?.close();
    } catch (e) {
      setSaveError((e as Error).message);
      setRetry(!(e instanceof ApiError) || e.status >= 500 ? request : null);
    } finally {
      setSaving(false);
      blocked.current = false;
      void refresh();
    }
  }
  function reorder(section: DashboardSection, delta: number) {
    setDraft((old) => {
      const sections = [...old.sections],
        i = sections.indexOf(section);
      [sections[i], sections[i + delta]] = [sections[i + delta], sections[i]];
      return { ...old, sections };
    });
  }
  async function completeTask(
    task: Pick<DashboardTask, "id" | "title" | "path" | "list">,
    completed: boolean,
  ) {
    if (await tasks.toggle(task, completed))
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLButtonElement>(
          completed
            ? `[data-home-recovery-id="${task.id}"] button`
            : `[data-home-task-id="${task.id}"] button`,
        );
        (
          target ??
          document.querySelector<HTMLButtonElement>(
            ".home-actionable .task-capture-trigger",
          )
        )?.focus();
      });
  }
  const hour = new Date().getHours(),
    greeting = !today
      ? "Welcome"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  return (
    <div className="home-dashboard home-actionable">
      <header className="home-daily-header">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground break-words">
              {greeting}
              {`, ${name}`}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Todo overview</h1>
          </div>
        </div>
        <div className="home-header-actions">
          <TaskCapture
            list={
              tasks.activeLists.some((l) => l.id === tasks.destination?.id)
                ? tasks.destination
                : null
            }
            busy={locked}
            change={tasks.write}
            destinations={tasks.activeLists}
            destinationId={tasks.destinationId}
            onDestinationChange={(id) => void tasks.selectDestination(id)}
            destinationLoading={tasks.destinationLoading}
            error={tasks.error || taskError}
            retry={retryTask ? tasks.repeat : undefined}
            onCreated={(title) => {
              if (tasks.destination)
                setCaptureNotice({
                  title,
                  listId: tasks.destination.id,
                  listTitle: tasks.destination.title,
                });
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Customize ${viewName}`}
            title={`Customize ${viewName}`}
            disabled={!data || !!retry || locked || !!retryTask}
            onClick={customize}
          >
            <Settings2 size={18} aria-hidden="true" />
          </Button>
        </div>
      </header>
      {(taskError || tasks.error || retryTask) && (
        <div role="alert" className="home-action-feedback">
          <p>
            {tasks.error ||
              taskError ||
              "A previous task change needs confirmation."}
          </p>
          {retryTask && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() => void tasks.repeat()}
            >
              Retry same request
            </Button>
          )}
        </div>
      )}
      {captureNotice &&
        tasks.activeLists.some((list) => list.id === captureNotice.listId) && (
          <div role="status" className="home-action-feedback">
            Added “{captureNotice.title}” to {captureNotice.listTitle}. New
            tasks have no due date, so they won’t appear in Today yet.
            <Button
              type="button"
              variant="ghost"
              onClick={() => chooseList(captureNotice.listId)}
            >
              Open list
            </Button>
          </div>
        )}
      {!!canRecover.length && (
        <section
          aria-label="Recently completed"
          className="home-recent-completed"
        >
          <h2 className="text-sm font-semibold">Recently completed</h2>
          <p className="text-xs text-muted-foreground">
            Reopen tasks completed here while {viewName} stays open.
          </p>
          {canRecover.map((task) => (
            <div
              key={task.id}
              className="home-recovery-row"
              data-home-recovery-id={task.id}
            >
              <span className="min-w-0 break-words">
                <span className="font-medium">{task.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {task.list.title}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={locked || !!retryTask}
                aria-label={`Reopen ${task.title}`}
                onClick={() => void completeTask(task, false)}
              >
                Reopen
              </Button>
            </div>
          ))}
        </section>
      )}
      {tasks.detailList &&
        tasks.detailId &&
        tasks.activeLists.some((l) => l.id === tasks.detailList?.id) && (
          <TaskDetailDrawer
            taskId={tasks.detailId}
            list={tasks.detailList}
            userId={userId}
            busy={locked}
            change={tasks.write}
            error={tasks.error || taskError}
            retry={retryTask ? tasks.repeat : undefined}
            refresh={tasks.refreshDetail}
            navigate={tasks.setDetailId}
          />
        )}
      {notice && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {catalogError ? (
        <div role="alert" className="list-browser-empty">
          <p>We couldn’t refresh your lists. Try again to see current lists.</p>
          <Button onClick={retryCatalog}>Retry lists</Button>
        </div>
      ) : (
        <ListBrowser
          lists={lists}
          choose={chooseList}
          create={createList}
          favorite={favorite}
          busy={locked}
        />
      )}
      {error ? (
        <div role="alert" className="rounded-xl border border-border p-5">
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void refresh()}
          >
            Retry {viewName}
          </Button>
        </div>
      ) : !data ? (
        <p role="status" className="text-muted-foreground">
          Sniffing out your day…
        </p>
      ) : (
        <>
          <div className="home-cards">
            {data.preferences.settings.sections
              .filter(
                (section) =>
                  !data.preferences.settings.hidden.includes(section),
              )
              .map((section) => (
                <section
                  key={section}
                  aria-labelledby={`home-${section}`}
                  className="home-card rounded-2xl border border-border bg-surface overflow-hidden"
                >
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <span className="text-primary">
                      {section === "favorites" ? (
                        <Star size={19} />
                      ) : (
                        <CalendarDays size={19} />
                      )}
                    </span>
                    <h2 id={`home-${section}`} className="text-lg font-bold">
                      {labels[section]}
                    </h2>
                    {section !== "favorites" && (
                      <span className="ml-auto text-sm text-muted-foreground">
                        {section === "today"
                          ? data.todayTotal
                          : data.upcomingTotal}
                      </span>
                    )}
                  </div>
                  {section === "favorites" ? (
                    <div className="p-3">
                      {data.favorites.length ? (
                        data.favorites
                          .filter((list) =>
                            tasks.activeLists.some(
                              (current) => current.id === list.id,
                            ),
                          )
                          .map((list) => (
                            <button
                              type="button"
                              key={list.id}
                              onClick={() => chooseList(list.id)}
                              className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 hover:bg-accent text-left"
                            >
                              <Star
                                size={17}
                                className="shrink-0"
                                style={{
                                  color: listPalette[list.color].accent,
                                }}
                              />
                              <span className="break-words min-w-0 font-semibold">
                                {list.title}
                              </span>
                              {list.shared && (
                                <span
                                  className="ml-auto shrink-0"
                                  title="Shared list"
                                >
                                  <Users size={16} />
                                  <span className="sr-only">Shared list</span>
                                </span>
                              )}
                              <ArrowRight
                                size={16}
                                className="ml-auto shrink-0"
                              />
                            </button>
                          ))
                      ) : (
                        <p className="p-3 text-sm text-muted-foreground">
                          Add your regular lists to Favorites in list settings.
                          They’ll be waiting here.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="px-5 pt-3 text-xs text-muted-foreground">
                        {section === "today"
                          ? "Due today and anything still overdue."
                          : `Tomorrow through ${formatDueDate(data.through)}.`}
                      </p>
                      <div className="p-2">
                        {(section === "today"
                          ? data.todayTasks
                          : data.upcomingTasks
                        )
                          .filter((task) =>
                            tasks.activeLists.some(
                              (list) => list.id === task.list.id,
                            ),
                          )
                          .map((task) => (
                            <div
                              key={task.id}
                              className="home-task-row"
                              data-home-task-id={task.id}
                            >
                              <button
                                type="button"
                                className="home-task-complete"
                                aria-label={`Complete ${task.title}`}
                                disabled={locked || !!retryTask}
                                onClick={async () => {
                                  await completeTask(task, true);
                                }}
                              >
                                <span
                                  className="task-checkbox"
                                  aria-hidden="true"
                                />
                              </button>
                              <a
                                href={task.path}
                                className="home-task-title"
                                aria-label={`Open task: ${task.title}`}
                                onClick={(event) => {
                                  if (
                                    !event.metaKey &&
                                    !event.ctrlKey &&
                                    !event.shiftKey &&
                                    !event.altKey &&
                                    event.button === 0
                                  ) {
                                    event.preventDefault();
                                    void tasks.openTask(task);
                                  }
                                }}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block font-semibold break-words">
                                    {task.title}
                                  </span>
                                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    <span className="break-words">
                                      {task.list.title}
                                      {task.parentTitle
                                        ? ` · ${task.parentTitle}`
                                        : ""}
                                    </span>
                                    {task.list.shared && (
                                      <span className="inline-flex items-center gap-1">
                                        <Users size={12} />
                                        Shared
                                      </span>
                                    )}
                                    <span
                                      className={
                                        task.dueDate < data.today
                                          ? "font-semibold text-red-800"
                                          : ""
                                      }
                                    >
                                      {task.dueDate < data.today
                                        ? "Overdue · "
                                        : ""}
                                      {formatDueDate(task.dueDate)}
                                    </span>
                                  </span>
                                </span>
                              </a>
                            </div>
                          ))}
                      </div>
                      {!(
                        section === "today"
                          ? data.todayTasks
                          : data.upcomingTasks
                      ).length && (
                        <p className="px-5 pb-5 text-sm text-muted-foreground">
                          {section === "today"
                            ? "Nothing due today. A little breathing room for your pack."
                            : "No tasks dated for the next seven days. Add a due date to see one here."}
                        </p>
                      )}
                      {(section === "today"
                        ? data.todayTotal
                        : data.upcomingTotal) > limit && (
                        <div className="px-5 pb-4">
                          {limit < 100 ? (
                            <Button
                              variant="ghost"
                              disabled={locked}
                              onClick={() =>
                                setLimit(Math.min(100, limit + 10))
                              }
                            >
                              Show more {labels[section].toLowerCase()} tasks
                            </Button>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Showing the first 100 tasks. Open your lists to
                              see the rest.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              ))}
          </div>
          {data.preferences.settings.hidden.length === 3 && (
            <div className="rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold">
                A quiet corner for your pack.
              </h2>
              <p className="text-muted-foreground mt-2">
                Choose Customize {viewName} to bring a section back.
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-6">
            Need a fresh list?{" "}
            <button
              type="button"
              className="text-primary font-semibold underline min-h-11"
              onClick={createList}
            >
              Create a list
            </button>
          </p>
        </>
      )}
      <dialog
        onKeyDown={containDialogFocus}
        ref={dialog}
        className="todo-settings-dialog m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-foreground/20"
        aria-labelledby="customize-home-heading"
        onCancel={(e) => {
          if (saving || retry) e.preventDefault();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(!!retry);
          }}
        >
          <div className="todo-dialog-heading flex items-center justify-between gap-3 mb-2">
            <h2 id="customize-home-heading" className="text-xl font-bold">
              Customize {viewName}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Close Customize ${viewName}`}
              disabled={saving || !!retry}
              onClick={() => dialog.current?.close()}
            >
              <X size={18} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Make this space yours. These choices only change your {viewName}.
          </p>
          <fieldset disabled={saving || !!retry} className="min-w-0">
            <legend className="text-sm font-bold mb-2">Sections</legend>
            {draft.sections.map((section, i) => (
              <div
                key={section}
                className="flex items-center gap-1 py-2 border-b border-border"
              >
                <label className="flex flex-1 min-w-0 items-center gap-3 min-h-11 text-sm">
                  <input
                    type="checkbox"
                    checked={!draft.hidden.includes(section)}
                    onChange={(e) =>
                      setDraft((old) => ({
                        ...old,
                        hidden: e.target.checked
                          ? old.hidden.filter((s) => s !== section)
                          : [...old.hidden, section],
                      }))
                    }
                  />
                  {labels[section]}
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={i === 0}
                  aria-label={`Move ${labels[section]} up`}
                  onClick={() => reorder(section, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={i === 2}
                  aria-label={`Move ${labels[section]} down`}
                  onClick={() => reorder(section, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
              </div>
            ))}
            <label
              className="block mt-5 mb-2 text-sm font-bold"
              htmlFor="home-start"
            >
              When I open Wuff Todo
            </label>
            <NativeSelect
              id="home-start"
              value={draft.startPage}
              onChange={(e) =>
                setDraft((old) => ({
                  ...old,
                  startPage: e.target.value as DashboardSettings["startPage"],
                }))
              }
            >
              <option value="home">Show {viewName}</option>
              <option value="last_list">
                Open my last list on this device
              </option>
            </NativeSelect>
            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              onClick={() =>
                setDraft(structuredClone(defaultDashboardSettings))
              }
            >
              Reset to default
            </Button>
          </fieldset>
          {saveError && (
            <div role="alert" className="text-sm text-red-800 my-3">
              <p>{saveError}</p>
              {!retry && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!today) return;
                    try {
                      const saved = await api<Dashboard>(
                        `/api/v1/dashboard?today=${today}&limit=${limit}`,
                      );
                      setData(saved);
                      setDraft(structuredClone(saved.preferences.settings));
                      setDraftVersion(saved.preferences.version);
                      setSaveError("");
                    } catch (e) {
                      setSaveError((e as Error).message);
                    }
                  }}
                >
                  Reload saved settings
                </Button>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" disabled={saving}>
              <Check size={16} />
              {saving
                ? "Saving…"
                : retry
                  ? "Retry same request"
                  : `Save ${viewName} settings`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving || !!retry}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
