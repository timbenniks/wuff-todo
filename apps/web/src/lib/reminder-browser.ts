import { unsubscribeBrowserPush } from "./browser-push";
// Unsubscribe before sign-out so a shared browser stops showing private alerts.
export async function disableBrowserOnSignOut() {
  try {
    const endpoint = await unsubscribeBrowserPush();
    if (!endpoint) return;
    await fetch("/api/v1/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "disableBrowser",
        input: { endpoint, operationId: crypto.randomUUID() },
      }),
    });
  } catch {
    /* Sign-out stays available; retired endpoints are removed on delivery. */
  }
}
