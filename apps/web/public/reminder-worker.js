"use strict";
(() => {
  // packages/contracts/src/modules/totake/notification.ts
  var notificationActionLifetime = 60 * 60 * 1e3;
  var uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  function validTotakeGroupId(value) {
    const m = /^(\d{1,5})-(\d{1,4})(?:@(\d{1,16}))?$/.exec(value);
    return !!m && Number(m[1]) <= 84e3 && Number(m[2]) < 1440 && (!m[3] || Number.isSafeInteger(Number(m[3])));
  }
  function totakeReminderPath(groupId, userId, snooze = false) {
    return `/totake?${new URLSearchParams({ reminder: groupId, account: userId, ...snooze ? { intent: "snooze" } : {} })}`;
  }
  function safeNotificationPath(value) {
    if (typeof value !== "string" || value.length > 500 || /[\\\u0000-\u0020]/.test(value))
      return "/settings/notifications";
    if (value === "/lists" || /^\/tasks\/[a-f0-9-]{36}$/.test(value) || value === "/totake")
      return value;
    if (!value.startsWith("/totake?")) return "/settings/notifications";
    const url = new URL(value, "https://wuff.invalid");
    const p = url.searchParams, group = p.get("reminder"), account = p.get("account"), intent = p.get("intent");
    if (url.hash || !group || !validTotakeGroupId(group) || account !== null && !uuid.test(account) || intent !== null && intent !== "snooze" || [...p.keys()].some(
      (k) => !["reminder", "account", "intent"].includes(k) || p.getAll(k).length !== 1
    ))
      return "/settings/notifications";
    return value;
  }
  function notificationItemIdentity(group, item) {
    return JSON.stringify([
      group.id,
      group.due,
      item.id,
      item.treatmentId ?? null,
      item.name,
      item.dose,
      item.quantity,
      item.unit,
      item.kind,
      item.alertInstant ?? null,
      item.sensorInsertion ?? false
    ]);
  }
  function notificationHistory(state, groupId, itemId) {
    return state.audit.filter((a) => a.groupId === groupId && a.itemId === itemId).at(-1)?.id ?? null;
  }
  function validateNotificationAction(state, change, context, userId, now) {
    if (context.userId !== userId || !Number.isSafeInteger(context.issuedAt) || !Number.isSafeInteger(context.expiresAt) || context.expiresAt <= context.issuedAt || context.issuedAt > now || context.expiresAt <= now || context.expiresAt > context.issuedAt + notificationActionLifetime)
      throw Error(
        "This notification is no longer current. Open the reminder to review it."
      );
    if (!(change.action === "record" && change.outcome === "taken") && change.action !== "snooze")
      throw Error("Use Totake to review this action.");
    if (!("groupId" in change) || change.groupId !== context.groupId || !("itemIds" in change) || change.itemIds.length !== 1 || change.itemIds[0] !== context.itemId)
      throw Error(
        "The notification selection changed. Open the reminder to review it."
      );
    const group = state.groups.find((g) => g.id === context.groupId);
    const item = group?.items.find((i) => i.id === context.itemId);
    if (!group || !item || group.records.some((r) => r.itemId === item.id) || group.items.filter((i) => !group.records.some((r) => r.itemId === i.id)).length !== 1 || (item.alertInstant ?? Infinity) > now || (group.reminders[item.id]?.snoozedInstant ?? -Infinity) > now || notificationItemIdentity(group, item) !== context.identity || notificationHistory(state, group.id, item.id) !== context.lastAuditId)
      throw Error(
        "This reminder changed. Open Totake to review before recording."
      );
  }

  // apps/web/src/workers/reminder-worker.ts
  var sw = globalThis;
  sw.addEventListener("install", (event) => event.waitUntil(sw.skipWaiting()));
  sw.addEventListener("activate", (event) => event.waitUntil(sw.clients.claim()));
  function noticeData(value) {
    const raw = value && typeof value === "object" ? value : {};
    let path = safeNotificationPath(raw.path);
    if (path.startsWith("/totake?") && !new URL(path, sw.location.origin).searchParams.has("account"))
      path = "/totake";
    const t = raw.totake;
    if (t && typeof t.userId === "string" && typeof t.groupId === "string" && path === totakeReminderPath(t.groupId, t.userId))
      return { path, totake: t };
    return { path };
  }
  function buttons(data) {
    const t = data.totake;
    if (!t) return [];
    const max = globalThis.Notification?.maxActions ?? 0;
    const actions = t.direct && t.direct.issuedAt <= Date.now() && t.direct.expiresAt > Date.now() ? [
      {
        action: "totake-record",
        title: t.kind === "equipment" ? "Done" : "Taken"
      },
      { action: "totake-snooze-15", title: "Snooze 15 min" }
    ] : [
      { action: "totake-review", title: "Review items" },
      { action: "totake-snooze-options", title: "Snooze\u2026" }
    ];
    return actions.slice(0, Math.max(0, Math.min(2, max)));
  }
  async function openReminder(path) {
    const url = new URL(safeNotificationPath(path), sw.location.origin).href;
    for (const client of await sw.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    })) {
      if (new URL(client.url).origin !== sw.location.origin) continue;
      try {
        if (client.url === url) return await client.focus();
        if (new URL(url).pathname === "/totake") continue;
        const next = await client.navigate(url);
        if (next) return await next.focus();
      } catch {
      }
    }
    return sw.clients.openWindow(url);
  }
  async function actionRequest(data, action) {
    const t = data.totake;
    if (!t?.direct || !["totake-record", "totake-snooze-15"].includes(action))
      throw Error("Review required");
    const headers = {
      "Content-Type": "application/json",
      "X-Wuff-User": t.userId
    };
    const read = await fetch("/api/v1/totake", {
      headers,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(1e4)
    });
    if (!read.ok) throw Error("Sign in and review");
    const current = await read.json();
    const change = action === "totake-record" ? {
      action: "record",
      groupId: t.groupId,
      itemIds: [t.direct.itemId],
      outcome: "taken"
    } : {
      action: "snooze",
      groupId: t.groupId,
      itemIds: [t.direct.itemId],
      minutes: 15
    };
    if (current.userId !== t.userId) throw Error("Account changed");
    validateNotificationAction(
      current.state,
      change,
      t.direct,
      t.userId,
      Date.now()
    );
    const input = {
      operationId: crypto.randomUUID(),
      version: current.version,
      change,
      notification: t.direct
    };
    const body = JSON.stringify(input);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fetch("/api/v1/totake", {
          method: "PUT",
          headers,
          body,
          credentials: "same-origin",
          redirect: "error",
          signal: AbortSignal.timeout(1e4)
        });
        if (!result.ok) {
          if (result.status >= 500 && attempt === 0) continue;
          throw new Error("Review required", { cause: "known" });
        }
        const saved = await result.json();
        if (saved.userId !== t.userId)
          throw new Error("Account changed", { cause: "known" });
        const group = saved.state.groups.find((g) => g.id === t.groupId);
        if (action === "totake-record" ? !group?.records.some(
          (r) => r.itemId === t.direct.itemId && r.outcome === "taken"
        ) : !group?.reminders[t.direct.itemId]?.snoozedInstant)
          throw new Error("Result changed", { cause: "known" });
        return;
      } catch (e) {
        if (attempt === 1 || e.cause === "known") throw e;
      }
    }
  }
  sw.addEventListener("push", (event) => {
    let raw;
    try {
      raw = event.data?.json();
    } catch {
    }
    const payload = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const data = noticeData(payload);
    const options = {
      body: typeof payload.body === "string" && payload.body ? payload.body.slice(0, 1e3) : "Open Wuff to view your reminder.",
      icon: "/icons/app-192.png",
      tag: typeof payload.tag === "string" ? payload.tag.slice(0, 200) : void 0,
      data,
      actions: buttons(data)
    };
    event.waitUntil(
      sw.registration.showNotification(
        typeof payload.title === "string" && payload.title ? payload.title.slice(0, 160) : "Wuff reminder",
        options
      )
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
          }
          try {
            await sw.registration.showNotification("Wuff Totake", {
              body: accepted ? event.action === "totake-record" ? "Recorded. Open Wuff to review or undo." : "Snoozed for 15 minutes." : "Couldn\u2019t confirm this action. Open Wuff to check before trying again.",
              tag: event.notification.tag,
              data: { path: data.path },
              icon: "/icons/app-192.png"
            });
          } catch {
            await openReminder(data.path);
            return;
          }
          if (!accepted) await openReminder(data.path);
          return;
        }
        const t = data.totake;
        return openReminder(
          event.action === "totake-snooze-options" && t ? totakeReminderPath(t.groupId, t.userId, true) : data.path
        );
      })()
    );
  });
})();
