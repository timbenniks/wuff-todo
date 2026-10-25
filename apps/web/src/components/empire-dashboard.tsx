"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, CheckCheck, Pill, Star } from "lucide-react";
import type { Dashboard, DashboardTask } from "@wuff/contracts";
import { Button } from "@wuff/ui/button";
import { useActorApi } from "@wuff/ui/features/actor-api";
import { useCalendarDay } from "@wuff/ui/features/lib/use-calendar-day";
import { formatDueDate } from "@wuff/ui/features/lib/due-date";
import { empireAppPreference } from "@wuff/contracts";
import { useEmpirePreferences } from "./empire-preferences";
import { empireApps, portalSections } from "@/lib/empire";
import {
  portalDashboardLoader,
  type PortalDashboardState,
} from "@/lib/portal-dashboard";
import { Corgi } from "./corgi";

function TaskPreview({
  tasks,
  total,
  title,
  today,
  empty,
}: {
  tasks: DashboardTask[];
  total: number;
  title: string;
  today: string;
  empty: string;
}) {
  const id = title === "Today" ? "empire-today" : "empire-upcoming";
  return (
    <section className="empire-preview" aria-labelledby={id}>
      <header>
        <h3 id={id}>
          <CalendarDays size={19} aria-hidden="true" />
          {title}
        </h3>
        <span className="empire-total" aria-label={`${total} tasks`}>
          {total}
        </span>
      </header>
      {tasks.length ? (
        <ul className="empire-task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <a href={task.path}>
                <span className="empire-task-title">{task.title}</span>
                <span className="empire-task-context">
                  {task.list.title}
                  {task.parentTitle ? ` · ${task.parentTitle}` : ""}
                </span>
                <span className="empire-task-date">
                  {task.dueDate < today ? "Overdue · " : ""}
                  <time dateTime={task.dueDate}>
                    {task.dueDate === today
                      ? "Today"
                      : formatDueDate(task.dueDate)}
                  </time>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empire-empty">{empty}</p>
      )}
      {total > tasks.length && (
        <p className="empire-preview-note">
          Showing {tasks.length} of {total}.{" "}
          <a href="/lists?home=1">See all in Todo</a>
        </p>
      )}
    </section>
  );
}

export function EmpireDashboard() {
  const preferences = useEmpirePreferences();
  const showTodo = preferences.settings
    ? empireAppPreference(preferences.settings.apps, "todo").visible &&
      empireAppPreference(preferences.settings.apps, "todo").dashboard
    : false;
  const api = useActorApi();
  const today = useCalendarDay();
  const [state, setState] = useState<PortalDashboardState>({
    status: "loading",
    data: null,
  });
  const loader = useRef<ReturnType<typeof portalDashboardLoader> | null>(null);
  useEffect(() => {
    if (!today || !showTodo) {
      setState({ status: "loading", data: null });
      return;
    }
    const current = portalDashboardLoader(
      (day) => api<Dashboard>(`/api/v1/dashboard?today=${day}&limit=5`),
      setState,
    );
    loader.current = current;
    const refresh = () => {
      if (!document.hidden) void current.refresh(today);
    };
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      current.dispose();
      if (loader.current === current) loader.current = null;
    };
  }, [api, today, showTodo]);
  const data = state.data;
  const sections = data ? portalSections(data) : [];
  return (
    <main id="empire-content" className="empire-page">
      <header className="empire-welcome">
        <div>
          <p className="empire-eyebrow">Your pack. One place.</p>
          <h1>
            {data ? `Welcome back, ${data.name}.` : "Welcome to Wuff Empire."}
          </h1>
          <p>A little less to remember. A little more room for life.</p>
        </div>
        <Corgi size={112} />
      </header>
      <section className="empire-apps" aria-labelledby="empire-apps-title">
        <h2 id="empire-apps-title">Your apps</h2>
        <div className="empire-app-grid">
          {empireApps
            .filter(
              (app) =>
                preferences.settings &&
                empireAppPreference(preferences.settings.apps, app.id).visible,
            )
            .map((app) => (
              <a className="empire-app-card" href={app.href} key={app.id}>
                <span className="empire-app-icon" aria-hidden="true">
                  {app.id === "todo" ? (
                    <CheckCheck size={28} />
                  ) : (
                    <Pill size={28} />
                  )}
                </span>
                <div>
                  <h3>{app.name}</h3>
                  <p>{app.description}</p>
                  <span className="empire-app-action">
                    {app.status === "available" ? "Open app" : "Coming soon"}
                    <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </div>
              </a>
            ))}
        </div>
        {!preferences.settings && (
          <p role="status">
            {preferences.error || "Fetching your app choices…"}
          </p>
        )}
        {preferences.error && (
          <Button onClick={() => void preferences.refresh()}>
            Retry app choices
          </Button>
        )}
        {preferences.settings &&
          empireApps.every(
            (app) =>
              !empireAppPreference(preferences.settings!.apps, app.id).visible,
          ) && (
            <p className="empire-state">
              Your apps are hidden.{" "}
              <a className="empire-text-link" href="/settings/apps">
                Choose your apps
              </a>
            </p>
          )}
      </section>
      {showTodo && (
        <section aria-labelledby="empire-todo-title" className="empire-todo">
          <header className="empire-section-heading">
            <div>
              <p className="empire-eyebrow">Your day, at a glance</p>
              <h2 id="empire-todo-title">From Wuff Todo</h2>
            </div>
            <a className="empire-text-link" href="/lists?home=1">
              Open overview <ArrowRight size={17} aria-hidden="true" />
            </a>
          </header>
          {state.status === "loading" && (
            <p role="status" className="empire-state">
              Fetching your Todo overview…
            </p>
          )}
          {state.status === "error" && (
            <div className="empire-state" role="alert">
              <h3>We couldn’t load your Todo overview.</h3>
              <p>
                Check your connection and try again. If your account changed,
                sign in again.
              </p>
              <Button
                onClick={() => today && void loader.current?.refresh(today)}
              >
                Retry Todo overview
              </Button>
              <a className="empire-text-link" href="/sign-in?next=%2F">
                Sign in again
              </a>
            </div>
          )}
          {data &&
            (sections.length ? (
              <div className="empire-preview-grid">
                {sections.map((section) =>
                  section === "favorites" ? (
                    <section
                      className="empire-preview empire-favorites"
                      key={section}
                      aria-labelledby="empire-favorites"
                    >
                      <header>
                        <h3 id="empire-favorites">
                          <Star size={19} aria-hidden="true" />
                          Favorite lists
                        </h3>
                      </header>
                      {data.favorites.length ? (
                        <ul>
                          {data.favorites.map((list) => (
                            <li key={list.id}>
                              <a
                                href={`/lists?listId=${encodeURIComponent(list.id)}`}
                              >
                                <span>{list.title}</span>
                                <ArrowRight size={17} aria-hidden="true" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="empire-empty">
                          Star a list in Todo to keep it close by.
                        </p>
                      )}
                    </section>
                  ) : (
                    <TaskPreview
                      key={section}
                      title={section === "today" ? "Today" : "Coming up"}
                      tasks={
                        section === "today"
                          ? data.todayTasks
                          : data.upcomingTasks
                      }
                      total={
                        section === "today"
                          ? data.todayTotal
                          : data.upcomingTotal
                      }
                      today={data.today}
                      empty={
                        section === "today"
                          ? "No tasks due today or overdue. A little breathing room."
                          : "No tasks due in the next seven days."
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="empire-state">
                <p>Your Todo overview sections are hidden.</p>
                <a className="empire-text-link" href="/lists?home=1">
                  Choose sections in Todo
                </a>
              </div>
            ))}
        </section>
      )}
    </main>
  );
}
