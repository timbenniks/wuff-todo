import webpush from "web-push";
import { createPrivateKey, createSign } from "node:crypto";
import { connect } from "node:http2";
import type { ReminderDevice } from "@wuff/contracts";
export type PushPayload = {
  title: string;
  body: string;
  path: string;
  tag: string;
};
export type PushTarget = ReminderDevice & {
  address: string;
  subscription: webpush.PushSubscription | null;
};
const has = (...names: string[]) => names.every((n) => !!process.env[n]);
export function reminderDeliveryStatus() {
  return {
    web: has("WEB_PUSH_PUBLIC_KEY", "WEB_PUSH_PRIVATE_KEY", "WEB_PUSH_SUBJECT"),
    ios: has(
      "APNS_KEY_ID",
      "APNS_TEAM_ID",
      "APNS_PRIVATE_KEY_BASE64",
      "APNS_IOS_TOPIC",
    ),
    macos: has(
      "APNS_KEY_ID",
      "APNS_TEAM_ID",
      "APNS_PRIVATE_KEY_BASE64",
      "APNS_MACOS_TOPIC",
    ),
    android: has("FCM_SERVICE_ACCOUNT_BASE64"),
    windows: has("WNS_CLIENT_ID", "WNS_CLIENT_SECRET"),
  };
}
// Never let a registered endpoint turn the sender into a general HTTP client.
export function allowedPushEndpoint(
  address: string,
  transport: "web" | "windows",
) {
  try {
    const u = new URL(address);
    if (u.protocol !== "https:" || u.port || u.username || u.password || u.hash)
      return false;
    const h = u.hostname;
    return transport === "windows"
      ? h.endsWith(".notify.windows.com")
      : h === "fcm.googleapis.com" ||
          h === "updates.push.services.mozilla.com" ||
          h.endsWith(".push.apple.com") ||
          h.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}
function jwt(
  header: object,
  claims: object,
  key: string,
  algorithm: "RSA-SHA256" | "SHA256",
) {
  const content = [header, claims]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".");
  const signer = createSign(algorithm).update(content);
  const signature = signer
    .sign({
      key: createPrivateKey(key),
      ...(algorithm === "SHA256" ? { dsaEncoding: "ieee-p1363" as const } : {}),
    })
    .toString("base64url");
  return `${content}.${signature}`;
}
export class PushTransportError extends Error {
  constructor(public permanent: boolean) {
    super("Notification delivery failed");
  }
}
async function checkedFetch(url: string, options: RequestInit) {
  return fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
}
const xml = (v: string) =>
  v.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export async function sendReminderPush(
  target: PushTarget,
  payload: PushPayload,
  dependencies: {
    fetch?: typeof checkedFetch;
    appleConnect?: typeof connect;
    webSend?: typeof webpush.sendNotification;
  } = {},
) {
  const fetchPush = dependencies.fetch ?? checkedFetch;
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
  if (target.transport === "ios" || target.transport === "macos") {
    const token = jwt(
      { alg: "ES256", kid: process.env.APNS_KEY_ID },
      { iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) },
      Buffer.from(process.env.APNS_PRIVATE_KEY_BASE64!, "base64").toString(),
      "SHA256",
    );
    const client = (dependencies.appleConnect ?? connect)(
      process.env.APNS_SANDBOX === "true"
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com",
    );
    try {
      await new Promise<void>((resolve, reject) => {
        client.on("error", () => reject(new PushTransportError(false)));
        const req = client.request({
          ":method": "POST",
          ":path": `/3/device/${target.address}`,
          authorization: `bearer ${token}`,
          "apns-topic":
            process.env[
              target.transport === "ios" ? "APNS_IOS_TOPIC" : "APNS_MACOS_TOPIC"
            ],
          "apns-push-type": "alert",
          "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
          "apns-collapse-id": payload.tag.slice(0, 64),
        });
        let status = 0;
        req.setTimeout(10_000, () => {
          req.close();
          reject(new PushTransportError(false));
        });
        req.on("response", (h) => {
          status = Number(h[":status"]);
        });
        req.on("error", () => reject(new PushTransportError(false)));
        req.on("data", () => {});
        req.on("end", () =>
          status === 200
            ? resolve()
            : reject(new PushTransportError(status === 410)),
        );
        req.end(
          JSON.stringify({
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: "default",
              "thread-id": "wuff-reminders",
            },
            path: payload.path,
            tag: payload.tag,
          }),
        );
      });
    } finally {
      client.close();
    }
    return;
  }
  if (target.transport === "android") {
    const service = JSON.parse(
      Buffer.from(process.env.FCM_SERVICE_ACCOUNT_BASE64!, "base64").toString(),
    );
    if (!/^[a-z0-9-]+$/.test(service.project_id))
      throw new PushTransportError(false);
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt(
      { alg: "RS256", typ: "JWT" },
      {
        iss: service.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
      service.private_key,
      "RSA-SHA256",
    );
    const auth = await fetchPush("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!auth.ok) throw new PushTransportError(false);
    const { access_token } = await auth.json();
    const result = await fetchPush(
      `https://fcm.googleapis.com/v1/projects/${service.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: target.address,
            notification: { title: payload.title, body: payload.body },
            data: { path: payload.path, tag: payload.tag },
            android: {
              ttl: "3600s",
              collapse_key: payload.tag,
              notification: { tag: payload.tag },
            },
          },
        }),
      },
    );
    if (!result.ok) {
      const error = await result.json().catch(() => ({}));
      const unregistered = error.error?.details?.some(
        (d: { errorCode?: string }) => d.errorCode === "UNREGISTERED",
      );
      throw new PushTransportError(!!unregistered);
    }
    return;
  }
  if (!allowedPushEndpoint(target.address, "windows"))
    throw new PushTransportError(true);
  const auth = await fetchPush("https://login.live.com/accesstoken.srf", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.WNS_CLIENT_ID!,
      client_secret: process.env.WNS_CLIENT_SECRET!,
      scope: "notify.windows.com",
    }),
  });
  if (!auth.ok) throw new PushTransportError(false);
  const { access_token } = await auth.json();
  const origin = new URL(process.env.WUFF_ORIGIN!);
  const launch = new URL(payload.path, origin).href;
  const response = await fetchPush(target.address, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "text/xml",
      "X-WNS-Type": "wns/toast",
      "X-WNS-TTL": "3600",
    },
    body: `<toast launch="${xml(launch)}" activationType="protocol"><visual><binding template="ToastGeneric"><text>${xml(payload.title)}</text><text>${xml(payload.body)}</text></binding></visual></toast>`,
  });
  if (!response.ok)
    throw new PushTransportError([404, 410].includes(response.status));
}
