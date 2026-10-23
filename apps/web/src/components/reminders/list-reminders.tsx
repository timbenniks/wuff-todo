"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useReminderRequest } from "./request";
type Setting = { version: number; dailyIncluded: boolean };
export function ListReminders({
  listId,
  userId,
}: {
  listId: string;
  userId: string;
}) {
  const [saved, setSaved] = useState<Setting | null>(null),
    [included, setIncluded] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const request = useReminderRequest(userId);
  async function load() {
    try {
      const result = await api<Setting>(
        `/api/v1/reminders?listId=${listId}`,
        "GET",
        undefined,
        userId,
      );
      setSaved(result);
      setIncluded(result.dailyIncluded);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    api<Setting>(`/api/v1/reminders?listId=${listId}`, "GET", undefined, userId)
      .then((s) => {
        if (active) {
          setSaved(s);
          setIncluded(s.dailyIncluded);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [listId, userId]);
  return (
    <section className="border-t border-border mt-6 pt-5">
      <h3 className="font-bold mb-2">Reminders for me</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Only your daily nudge changes. Everyone else keeps their own
        preferences.
      </p>
      {saved && (
        <>
          <label className="flex items-start gap-3 text-sm min-h-11">
            <input
              type="checkbox"
              className="size-5 shrink-0 mt-1 accent-primary"
              disabled={busy}
              checked={included}
              onChange={(e) => setIncluded(e.target.checked)}
            />
            Include tasks from this list in my daily nudge
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setStatus("");
              try {
                const result = await request<Setting>("list", {
                  listId,
                  version: saved.version,
                  dailyIncluded: included,
                });
                setSaved(result);
                setIncluded(result.dailyIncluded);
                setStatus("Your list preference is saved.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save my list reminders
          </Button>
        </>
      )}
      {!saved && !error && (
        <p role="status" className="text-sm">
          Loading your preferences…
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-red-800 mt-3">
          <p>{error}</p>
          <Button type="button" variant="ghost" onClick={load}>
            Load latest preference
          </Button>
        </div>
      )}
      {status && (
        <p role="status" className="text-sm mt-3">
          {status}
        </p>
      )}
      <a
        className="block text-sm text-primary underline mt-4"
        href="/settings/reminders"
      >
        Set daily time &amp; notification devices
      </a>
    </section>
  );
}
