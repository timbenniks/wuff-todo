// Browser-only notification lifecycle. No task cache or background fetches.
export function browserPushSupport() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}
export async function currentBrowserSubscription() {
  if (!browserPushSupport()) return null;
  const registration = await navigator.serviceWorker.getRegistration(
    "/reminder-worker.js",
  );
  return (await registration?.pushManager.getSubscription()) ?? null;
}
function keyBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    (c) => c.charCodeAt(0),
  );
}
export async function enableBrowserPush(publicKey: string) {
  if (!browserPushSupport())
    throw Error(
      "This browser cannot receive web notifications. On iPhone, add Wuff to your Home Screen using Safari’s Share menu, then open it from that icon.",
    );
  // Must run directly from the Enable click, before worker/network awaits.
  const permission = await Notification.requestPermission();
  if (permission === "denied")
    throw Error(
      "Notifications are blocked. Allow Wuff in your browser or device notification settings, then try again.",
    );
  if (permission !== "granted")
    throw Error(
      "Notification permission wasn’t granted. Choose Enable this browser when you’re ready.",
    );
  const key = keyBytes(publicKey);
  if (key.length !== 65 || key[0] !== 4)
    throw Error(
      "Web notification setup is invalid. Ask the Wuff owner to check the web push keys.",
    );
  await navigator.serviceWorker.register("/reminder-worker.js", { scope: "/" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error(
                "The notification worker didn’t become ready. Reload Wuff and try again.",
              ),
            ),
          12_000,
        );
      }),
    ]);
    const existing = await registration.pushManager.getSubscription();
    if (existing?.options.applicationServerKey) {
      const previous = new Uint8Array(existing.options.applicationServerKey);
      if (
        previous.length !== key.length ||
        previous.some((v, i) => v !== key[i])
      )
        throw Error(
          "This browser uses an older notification key. Turn off this browser, then enable it again.",
        );
    }
    return (
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }))
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function unsubscribeBrowserPush() {
  const subscription = await currentBrowserSubscription();
  if (!subscription) return null;
  if (!(await subscription.unsubscribe()))
    throw Error(
      "This browser could not turn off notifications. Try again before signing out of a shared device.",
    );
  return subscription.endpoint;
}
