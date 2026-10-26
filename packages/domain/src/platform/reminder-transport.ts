import webpush from "web-push";
import type { ReminderDevice } from "@wuff/contracts";
export type PushPayload = {
  title: string;
  body: string;
  path: string;
  tag: string;
  totake?: import("@wuff/contracts/modules/totake/notification").TotakeNotification;
};
export type PushTarget = ReminderDevice & {
  address: string;
  subscription: webpush.PushSubscription | null;
};
const has = (...names: string[]) => names.every((n) => !!process.env[n]);
export function reminderDeliveryStatus() {
  return {
    web: has("WEB_PUSH_PUBLIC_KEY", "WEB_PUSH_PRIVATE_KEY", "WEB_PUSH_SUBJECT"),
    // Historical records remain removable; native delivery is permanently retired.
    ios: false,
    macos: false,
    android: false,
    windows: false,
  };
}
// Never let a registered endpoint turn the sender into a general HTTP client.
export function allowedPushEndpoint(address: string, transport: "web") {
  try {
    const u = new URL(address);
    if (u.protocol !== "https:" || u.port || u.username || u.password || u.hash)
      return false;
    const h = u.hostname;
    return (
      transport === "web" &&
      (h === "fcm.googleapis.com" ||
        h === "updates.push.services.mozilla.com" ||
        h.endsWith(".push.apple.com") ||
        h.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export class PushTransportError extends Error {
  constructor(public permanent: boolean) {
    super("Notification delivery failed");
  }
}
export async function sendReminderPush(
  target: PushTarget,
  payload: PushPayload,
  dependencies: {
    webSend?: typeof webpush.sendNotification;
  } = {},
) {
  if (target.transport !== "web") throw new PushTransportError(true);
  if (!reminderDeliveryStatus()[target.transport])
    throw new PushTransportError(false);
  if (target.transport === "web") {
    if (!target.subscription || !allowedPushEndpoint(target.address, "web"))
      throw new PushTransportError(true);
    try {
      await (dependencies.webSend ?? webpush.sendNotification)(
        target.subscription,
        JSON.stringify(payload),
        {
          TTL: 3600,
          timeout: 10_000,
          vapidDetails: {
            subject: process.env.WEB_PUSH_SUBJECT!,
            publicKey: process.env.WEB_PUSH_PUBLIC_KEY!,
            privateKey: process.env.WEB_PUSH_PRIVATE_KEY!,
          },
        },
      );
    } catch (e) {
      throw new PushTransportError(
        [404, 410].includes((e as { statusCode: number }).statusCode),
      );
    }
    return;
  }
}
