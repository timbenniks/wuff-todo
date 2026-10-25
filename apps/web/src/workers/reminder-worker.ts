/// <reference lib="webworker" />
import {
  safeNotificationPath,
  totakeReminderPath,
  validateNotificationAction,
} from "@wuff/contracts/modules/totake/notification";
import type { TotakeNotification } from "@wuff/contracts/modules/totake/notification";
import type { TotakeMutation, TotakeSnapshot } from "@wuff/contracts";
const sw = globalThis as unknown as ServiceWorkerGlobalScope;
// Replace the old UUID-only worker without waiting for every Wuff tab to close.
sw.addEventListener("install", (event) => event.waitUntil(sw.skipWaiting()));
sw.addEventListener("activate", (event) => event.waitUntil(sw.clients.claim()));
type Notice = { path: string; totake?: TotakeNotification };
function noticeData(value: unknown): Notice {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  let path = safeNotificationPath(raw.path);
  // Legacy displayed notifications cannot identify which account owned the group.
  // Open the overview rather than another account's same-day reminder.
  if (
    path.startsWith("/totake?") &&
    !new URL(path, sw.location.origin).searchParams.has("account")
  )
    path = "/totake";
  const t = raw.totake as TotakeNotification | undefined;
  // Reject mismatched action metadata; server schema/authorization is still mandatory.
  if (
    t &&
    typeof t.userId === "string" &&
    typeof t.groupId === "string" &&
    path === totakeReminderPath(t.groupId, t.userId)
  )
    return { path, totake: t };
  return { path };
}
function buttons(data: Notice) {
  const t = data.totake;
  if (!t) return [];
  const max =
    (globalThis as { Notification?: { maxActions?: number } }).Notification
      ?.maxActions ?? 0;
  const actions =
    t.direct &&
    t.direct.issuedAt <= Date.now() &&
    t.direct.expiresAt > Date.now()
      ? [
          {
            action: "totake-record",
            title: t.kind === "equipment" ? "Done" : "Taken",
          },
          { action: "totake-snooze-15", title: "Snooze 15 min" },
        ]
      : [
          { action: "totake-review", title: "Review items" },
          { action: "totake-snooze-options", title: "Snooze…" },
        ];
  return actions.slice(0, Math.max(0, Math.min(2, max)));
}
async function openReminder(path: string) {
  const url = new URL(safeNotificationPath(path), sw.location.origin).href;
  for (const client of await sw.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  })) {
    if (new URL(client.url).origin !== sw.location.origin) continue;
    try {
      if (client.url === url) return await (client as WindowClient).focus();
      // Never replace a Totake editor/draft to open another reminder.
      if (new URL(url).pathname === "/totake") continue;
      const next = await (client as WindowClient).navigate(url);
      if (next) return await next.focus();
    } catch {
      /* Closing window: try another or open. */
    }
  }
  return sw.clients.openWindow(url);
}
async function actionRequest(data: Notice, action: string) {
  const t = data.totake;
  if (!t?.direct || !["totake-record", "totake-snooze-15"].includes(action))
    throw Error("Review required");
  const headers = {
    "Content-Type": "application/json",
    "X-Wuff-User": t.userId,
  };
  const read = await fetch("/api/v1/totake", {
    headers,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!read.ok) throw Error("Sign in and review");
  const current = (await read.json()) as TotakeSnapshot;
  const change: TotakeMutation["change"] =
    action === "totake-record"
      ? {
          action: "record",
          groupId: t.groupId,
          itemIds: [t.direct.itemId],
          outcome: "taken",
        }
      : {
          action: "snooze",
          groupId: t.groupId,
          itemIds: [t.direct.itemId],
          minutes: 15,
        };
  if (current.userId !== t.userId) throw Error("Account changed");
  validateNotificationAction(
    current.state,
    change,
    t.direct,
    t.userId,
    Date.now(),
  );
  const input: TotakeMutation = {
    operationId: crypto.randomUUID(),
    version: current.version,
    change,
    notification: t.direct,
  };
  // Retry only an uncertain write, with byte-identical arguments. Never queue offline.
  const body = JSON.stringify(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetch("/api/v1/totake", {
        method: "PUT",
        headers,
        body,
        credentials: "same-origin",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) {
        if (result.status >= 500 && attempt === 0) continue;
        throw new Error("Review required", { cause: "known" });
      }
      const saved = (await result.json()) as TotakeSnapshot;
      // A successful receipt is authoritative; do not infer success from a closed toast.
      if (saved.userId !== t.userId)
        throw new Error("Account changed", { cause: "known" });
      const group = saved.state.groups.find((g) => g.id === t.groupId);
      if (
        action === "totake-record"
          ? !group?.records.some(
              (r) => r.itemId === t.direct!.itemId && r.outcome === "taken",
            )
          : !group?.reminders[t.direct.itemId]?.snoozedInstant
      )
        throw new Error("Result changed", { cause: "known" });
      return;
    } catch (e) {
      if (attempt === 1 || (e as Error).cause === "known") throw e;
    }
  }
}
sw.addEventListener("push", (event) => {
  let raw: unknown;
  try {
    raw = event.data?.json();
  } catch {
    /* Visible generic fallback. */
  }
  const payload =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const data = noticeData(payload);
  const options: NotificationOptions & { actions: ReturnType<typeof buttons> } =
    {
      body:
        typeof payload.body === "string" && payload.body
          ? payload.body.slice(0, 1000)
          : "Open Wuff to view your reminder.",
      icon: "/icons/app-192.png",
      tag:
        typeof payload.tag === "string" ? payload.tag.slice(0, 200) : undefined,
      data,
      actions: buttons(data),
    };
  event.waitUntil(
    sw.registration.showNotification(
      typeof payload.title === "string" && payload.title
        ? payload.title.slice(0, 160)
        : "Wuff reminder",
      options,
    ),
  );
});
sw.addEventListener("notificationclick", (event) => {
  const data = noticeData(event.notification.data);
  event.notification.close();
  event.waitUntil(
    (async () => {
      if (["totake-record", "totake-snooze-15"].includes(event.action)) {
        let accepted = false;
        try {
          await actionRequest(data, event.action);
          accepted = true;
        } catch {
          /* Unconfirmed writes always require authoritative review. */
        }
        try {
          await sw.registration.showNotification("Wuff Totake", {
            body: accepted
              ? event.action === "totake-record"
                ? "Recorded. Open Wuff to review or undo."
                : "Snoozed for 15 minutes."
              : "Couldn’t confirm this action. Open Wuff to check before trying again.",
            tag: event.notification.tag,
            data: { path: data.path },
            icon: "/icons/app-192.png",
          });
        } catch {
          // Permission can change after the original notification was displayed.
          // Display failure must not cause another mutation or hide the review path.
          await openReminder(data.path);
          return;
        }
        if (!accepted) await openReminder(data.path);
        return;
      }
      const t = data.totake;
      return openReminder(
        event.action === "totake-snooze-options" && t
          ? totakeReminderPath(t.groupId, t.userId, true)
          : data.path,
      );
    })(),
  );
});
// No notificationclose handler: dismissal must never record, skip or snooze.
// No fetch interception, caches, background sync or offline mutation queue.
