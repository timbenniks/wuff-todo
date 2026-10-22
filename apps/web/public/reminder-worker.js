// Push delivery only. No fetch interception, caches or offline task data.
self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const path =
    typeof payload.path === "string" &&
    /^\/(lists|tasks\/[a-f0-9-]{36})$/.test(payload.path)
      ? payload.path
      : "/lists";
  event.waitUntil(
    self.registration.showNotification(payload.title || "Wuff reminder", {
      body: payload.body || "You have a reminder.",
      icon: "/icons/app-192.png",
      tag: payload.tag,
      data: { path },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.path || "/lists",
    self.location.origin,
  ).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const client of windows)
          if (new URL(client.url).origin === self.location.origin) {
            await client.navigate(url);
            return client.focus();
          }
        return clients.openWindow(url);
      }),
  );
});
