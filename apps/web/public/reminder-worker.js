// Push delivery only. No fetch interception, caches or offline task data.
function notificationPath(value) {
  if (typeof value !== "string") return "/settings/notifications";
  if (/^\/tasks\/[a-f0-9-]{36}$/.test(value) || value === "/lists")
    return value;
  if (value === "/totake" || /^\/totake\?reminder=[a-f0-9-]{36}$/.test(value))
    return value;
  return "/settings/notifications";
}
self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    /* Show safe fallback for malformed pushes. */
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    payload = {};
  event.waitUntil(
    self.registration.showNotification(
      typeof payload.title === "string" && payload.title
        ? payload.title.slice(0, 160)
        : "Wuff reminder",
      {
        body:
          typeof payload.body === "string" && payload.body
            ? payload.body.slice(0, 1000)
            : "Open Wuff to view your reminder.",
        icon: "/icons/app-192.png",
        tag:
          typeof payload.tag === "string"
            ? payload.tag.slice(0, 200)
            : undefined,
        data: { path: notificationPath(payload.path) },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Validate again: old displayed notifications can outlive a worker update.
  const url = new URL(
    notificationPath(event.notification.data?.path),
    self.location.origin,
  ).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          try {
            const navigated = await client.navigate(url);
            if (navigated) return await navigated.focus();
          } catch {
            /* A closing window must not prevent opening the reminder. */
          }
        }
        return clients.openWindow(url);
      }),
  );
});
