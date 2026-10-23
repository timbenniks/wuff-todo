"use client";
import { useState } from "react";
import { Bell, Smartphone, Monitor, X } from "lucide-react";
import type { ReminderSettings } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReminderRequest } from "@/components/reminders/request";
import { api } from "@/lib/api";
export function ReminderSettingsForm({
  initial,
  userId,
}: {
  initial: ReminderSettings;
  userId: string;
}) {
  const [saved, setSaved] = useState(initial),
    [draft, setDraft] = useState(initial.preferences),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const request = useReminderRequest(userId);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enableBrowser() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window))
      throw Error(
        "This browser cannot receive push notifications. On iPhone, add Wuff to your Home Screen and open it there.",
      );
    const permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error(
        "Notifications are blocked. Allow them in your browser or device settings, then try again.",
      );
    await navigator.serviceWorker.register("/reminder-worker.js");
    const registration = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(
      atob(saved.publicKey!.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
    const next = await request<ReminderSettings>("device", {
      label: "This browser",
      transport: "web",
      address: subscription.endpoint,
      subscription: subscription.toJSON(),
    });
    setSaved(next);
    setStatus("This browser can now receive reminders.");
  }
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <Bell size={22} className="text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold">Reminders</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        A gentle nudge for things still on your list. These settings are just
        for you.
      </p>
      {!saved.schedulerReady && (
        <p
          role="status"
          className="rounded-xl border border-border bg-accent p-4 text-sm mb-6"
        >
          Reminders aren’t ready to send yet. You can save your preferences, but
          notifications will start only after setup is complete.
        </p>
      )}
      <form
        className="grid gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            const next = await request<ReminderSettings>("settings", {
              version: saved.version,
              preferences: draft,
            });
            setSaved(next);
            setDraft(next.preferences);
            setStatus("Reminder preferences saved.");
          });
        }}
      >
        <fieldset
          disabled={busy}
          className="rounded-2xl border border-border p-5 grid gap-4"
        >
          <legend className="px-2 text-sm font-semibold">Daily nudge</legend>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1 size-5 shrink-0 accent-primary"
              type="checkbox"
              checked={draft.dailyEnabled}
              onChange={(e) =>
                setDraft({ ...draft, dailyEnabled: e.target.checked })
              }
            />
            <span>
              <span className="font-semibold block">
                Remind me about unfinished tasks
              </span>
              <span className="text-muted-foreground">
                One notification for tasks due today or overdue. Choose included
                lists in each list’s settings.
              </span>
            </span>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Send at
            <Input
              type="time"
              required
              value={draft.dailyTime}
              onChange={(e) =>
                setDraft({ ...draft, dailyTime: e.target.value })
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Timezone
            <Input
              required
              value={draft.timezone}
              list="reminder-timezones"
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            />
            <datalist id="reminder-timezones">
              {[
                "Europe/Paris",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "Asia/Tokyo",
                "Australia/Sydney",
                "UTC",
              ].map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
            <span className="text-xs font-normal text-muted-foreground">
              Local times follow daylight-saving changes.
            </span>
          </label>
          <Button
            type="button"
            variant="ghost"
            className="justify-self-start"
            onClick={() =>
              setDraft({
                ...draft,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              })
            }
          >
            Use this device’s timezone
          </Button>
        </fieldset>
        <fieldset
          disabled={busy}
          className="rounded-2xl border border-border p-5 grid gap-4"
        >
          <legend className="px-2 text-sm font-semibold">
            Quiet hours &amp; privacy
          </legend>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              className="size-5 shrink-0 accent-primary"
              type="checkbox"
              checked={draft.quietEnabled}
              onChange={(e) =>
                setDraft({ ...draft, quietEnabled: e.target.checked })
              }
            />
            Keep reminders quiet overnight
          </label>
          {draft.quietEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm">
                From
                <Input
                  type="time"
                  required
                  value={draft.quietStart}
                  onChange={(e) =>
                    setDraft({ ...draft, quietStart: e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm">
                Until
                <Input
                  type="time"
                  required
                  value={draft.quietEnd}
                  onChange={(e) =>
                    setDraft({ ...draft, quietEnd: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Reminders during quiet hours wait until quiet hours end.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1 size-5 shrink-0 accent-primary"
              type="checkbox"
              checked={draft.showTaskTitles}
              onChange={(e) =>
                setDraft({ ...draft, showTaskTitles: e.target.checked })
              }
            />
            <span>
              Show task names in notifications
              <span className="block text-xs text-muted-foreground mt-1">
                Names may be visible on your lock screen. Hidden by default.
              </span>
            </span>
          </label>
        </fieldset>
        <Button
          disabled={busy}
          type="submit"
          variant="primary"
          className="justify-self-start"
        >
          {busy ? "Saving…" : "Save reminder preferences"}
        </Button>
      </form>
      <section className="mt-8 border-t border-border pt-6">
        <h3 className="font-bold text-lg mb-2">Your devices</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Reminders go to the devices you enable. Permission is managed
          separately on each device.
        </p>
        <Button
          variant="outline"
          disabled={busy || !saved.delivery.web || !saved.publicKey}
          onClick={() => void action(enableBrowser)}
        >
          Enable this browser
        </Button>
        {!saved.delivery.web && (
          <p className="text-xs text-muted-foreground mt-2">
            Web push setup is still needed before you can enable this browser.
          </p>
        )}
        {saved.devices.length ? (
          <ul className="mt-4 divide-y divide-border">
            {saved.devices.map((device) => (
              <li key={device.id} className="flex items-center gap-3 py-3">
                <span aria-hidden="true">
                  {["ios", "android"].includes(device.transport) ? (
                    <Smartphone size={18} />
                  ) : (
                    <Monitor size={18} />
                  )}
                </span>
                <span className="flex-1 min-w-0 break-words text-sm">
                  {device.label}
                  <span className="block text-xs text-muted-foreground">
                    {device.transport}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${device.label}`}
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      setSaved(
                        await request<ReminderSettings>("removeDevice", {
                          deviceId: device.id,
                        }),
                      );
                      setStatus("Device removed.");
                    })
                  }
                >
                  <X size={18} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-4">
            No devices enabled yet.
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          On iPhone, web notifications require opening Wuff from its Home Screen
          icon. Native apps register from their own notification settings.
        </p>
      </section>
      {status && (
        <p role="status" className="mt-5 text-sm text-primary">
          {status}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <Button
            className="mt-3"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const next = await api<ReminderSettings>(
                  "/api/v1/reminders",
                  "GET",
                  undefined,
                  userId,
                );
                setSaved(next);
                setDraft(next.preferences);
                setStatus("Latest preferences loaded.");
              })
            }
          >
            Load latest preferences
          </Button>
        </div>
      )}
    </section>
  );
}
