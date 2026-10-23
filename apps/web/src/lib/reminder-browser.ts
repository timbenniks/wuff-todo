// Unsubscribe before sign-out so a shared browser stops showing private alerts.
export async function disableBrowserOnSignOut() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration(
      "/reminder-worker.js",
    );
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch("/api/v1/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "disableBrowser",
        input: { endpoint, operationId: crypto.randomUUID() },
      }),
    });
  } catch {
    /* OS subscription removal is best effort; sign-out stays available. */
  }
}
