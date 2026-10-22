"use client";
import { useEffect, useState } from "react";
import type { PersonalReminder, ReminderSettings } from "@wuff/contracts";
import { useActorApi } from "../../actor-api";
import { Button } from "../../../button";
import { Input } from "../../../input";
import { useReminderRequest } from "./request";
export function TaskReminder({
  listId,
  taskId,
  userId,
  inactive,
  onClose,
}: {
  listId: string;
  taskId: string;
  userId: string;
  inactive: boolean;
  onClose?: () => void;
}) {
  const api = useActorApi();
  const [loaded, setLoaded] = useState(false),
    [reminder, setReminder] = useState<PersonalReminder | null>(null),
    [settings, setSettings] = useState<ReminderSettings | null>(null),
    [local, setLocal] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const request = useReminderRequest(userId);
  async function load() {
    const [result, prefs] = await Promise.all([
      api<{ reminder: PersonalReminder | null }>(
        `/api/v1/reminders?listId=${listId}&taskId=${taskId}`,
        "GET",
        undefined,
        userId,
      ),
      api<ReminderSettings>("/api/v1/reminders", "GET", undefined, userId),
    ]);
    setReminder(result.reminder);
    setSettings(prefs);
    setLoaded(true);
  }
  useEffect(() => {
    let live = true;
    Promise.all([
      api<{ reminder: PersonalReminder | null }>(
        `/api/v1/reminders?listId=${listId}&taskId=${taskId}`,
        "GET",
        undefined,
        userId,
      ),
      api<ReminderSettings>("/api/v1/reminders", "GET", undefined, userId),
    ])
      .then(([r, p]) => {
        if (live) {
          setReminder(r.reminder);
          setSettings(p);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [listId, taskId, userId]);
  async function save(runAt: string | null) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await request<{ reminder: PersonalReminder }>("task", {
        listId,
        taskId,
        version: reminder?.version ?? 0,
        runAt,
      });
      setReminder(result.reminder);
      setStatus(
        runAt ? "Your reminder is saved." : "Your reminder is removed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 grid gap-3 text-sm"
      aria-label="Personal task reminder"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">Remind me</h3>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Just for you. Completing this task stops its reminder.
      </p>
      {!loaded && !error && <p role="status">Loading your reminder…</p>}
      {loaded && settings && (
        <>
          {reminder?.enabled && (
            <p>
              Scheduled for{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: settings.preferences.timezone,
              }).format(new Date(reminder.runAt))}
              .{" "}
              {reminder.scheduling === "pending"
                ? "Waiting for scheduling."
                : ""}
            </p>
          )}
          {reminder && !reminder.enabled && (
            <p className="text-muted-foreground">No active reminder.</p>
          )}
          {(!settings.schedulerReady || !settings.devices.length) && (
            <p className="text-xs text-muted-foreground">
              {!settings.schedulerReady ? "Scheduling setup is pending. " : ""}
              {!settings.devices.length
                ? "Enable a notification device in Settings to receive reminders."
                : ""}
            </p>
          )}
          {!inactive && (
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const result = await api<{ runAt: string }>(
                    "/api/v1/reminders",
                    "POST",
                    {
                      action: "localTime",
                      input: { local, timezone: settings.preferences.timezone },
                    },
                    userId,
                  );
                  await save(result.runAt);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="grid gap-2">
                Date and time · {settings.preferences.timezone}
                <Input
                  type="datetime-local"
                  required
                  value={local}
                  disabled={busy}
                  onChange={(e) => setLocal(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Quiet hours apply. Your due date stays the same.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" type="submit" disabled={busy}>
                  Save reminder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    save(new Date(Date.now() + 3600000).toISOString())
                  }
                >
                  In one hour
                </Button>
                {reminder?.enabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => save(null)}
                  >
                    Remove reminder
                  </Button>
                )}
              </div>
            </form>
          )}
          {inactive && (
            <p className="text-muted-foreground">
              Reopen the task in an active list to set a reminder.
            </p>
          )}
          <a
            href="/settings/reminders"
            className="text-primary underline text-xs"
          >
            Reminder preferences
          </a>
        </>
      )}
      {status && <p role="status">{status}</p>}
      {error && (
        <div role="alert" className="text-red-800">
          <p>{error}</p>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              load()
                .then(() => setError(""))
                .catch((e) => setError(e.message))
            }
          >
            Load latest reminder
          </Button>
        </div>
      )}
    </section>
  );
}
