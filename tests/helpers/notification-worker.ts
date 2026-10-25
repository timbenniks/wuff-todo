import { buildSync } from "esbuild";
import { runInNewContext } from "node:vm";
const code = buildSync({
  entryPoints: ["apps/web/src/workers/reminder-worker.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
}).outputFiles[0].text;
export function notificationWorker(maxActions = 2) {
  const handlers: Record<string, (event: any) => void> = {},
    shown: any[] = [],
    opened: string[] = [],
    requests: { url: string; options: RequestInit }[] = [];
  let displayFailure = false;
  const lifecycle = { skipped: 0, claimed: 0 };
  const clients = {
    claim: async () => {
      lifecycle.claimed++;
    },
    matchAll: async () => [] as any[],
    openWindow: async (url: string) => {
      opened.push(url);
    },
  };
  let request: (
    url: string,
    options: RequestInit,
  ) => Promise<Response> = async () => {
    throw Error("No provider or network allowed in worker unit tests");
  };
  runInNewContext(code, {
    skipWaiting: async () => {
      lifecycle.skipped++;
    },
    addEventListener: (name: string, handler: any) => {
      handlers[name] = handler;
    },
    registration: {
      showNotification: async (...args: any[]) => {
        if (displayFailure) throw Error("Notification permission revoked");
        shown.push(args);
      },
    },
    location: { origin: "https://wuff.example" },
    clients,
    Notification: { maxActions },
    URL,
    URLSearchParams,
    Date,
    crypto,
    AbortSignal,
    fetch: async (url: string, options: RequestInit) => {
      requests.push({ url, options });
      return request(url, options);
    },
  });
  return {
    handlers,
    failDisplay: () => {
      displayFailure = true;
    },
    lifecycle,
    shown,
    opened,
    clients,
    requests,
    setFetch: (fn: typeof request) => {
      request = fn;
    },
    dispatch: async (name: string, event: any) => {
      let pending: Promise<any> | undefined;
      handlers[name]?.({
        ...event,
        waitUntil: (p: Promise<any>) => {
          pending = p;
        },
      });
      await pending;
    },
  };
}
