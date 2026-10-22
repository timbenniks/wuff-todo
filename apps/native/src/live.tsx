import { useEffect, useRef, useState } from "react";
import { LiveUpdates } from "@wuff/ui/live-updates";
import type { LiveLists } from "@wuff/ui/live-types";
import { LiveRefreshQueue } from "@wuff/client/live-refresh";
import { ClientError } from "@wuff/client";
import { client } from "./session";

const isVisible = () => document.visibilityState !== "hidden";
export function NativeLive({ refresh }: { refresh: () => Promise<void> }) {
  const current = useRef(refresh);
  current.current = refresh;
  const [config, setConfig] = useState<LiveLists | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(isVisible());
  const [status, setStatus] = useState("connecting");
  const queue = useRef<LiveRefreshQueue | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const terminal = (error: unknown) => {
    if (
      error instanceof ClientError &&
      [401, 403, 409].includes(error.status)
    ) {
      void client.clear().catch(() => {});
      return true;
    }
    return false;
  };
  useEffect(() => {
    let active = true,
      acquiring = false;
    const work = new LiveRefreshQueue(
      () => current.current(),
      () => !isVisible(),
    );
    queue.current = work;
    const acquire = async () => {
      if (acquiring || !active || !isVisible()) return;
      acquiring = true;
      try {
        const session = await client.call<{ userId: string }>("session");
        const next = await client.call<LiveLists>("getLive", {
          userId: session.userId,
        });
        if (active && isVisible()) {
          setUserId(session.userId);
          setConfig(next);
        }
      } catch (error) {
        if (active) {
          setStatus("error");
          terminal(error);
        }
      } finally {
        acquiring = false;
      }
    };
    const reconcile = () => {
      const showing = isVisible();
      setVisible(showing);
      if (!showing) {
        configRef.current = null;
        setConfig(null);
        return;
      }
      void work.notify();
      if (!configRef.current) void acquire();
    };
    void acquire();
    const timer = setInterval(reconcile, 10_000);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", reconcile);
    return () => {
      active = false;
      work.stop();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("online", reconcile);
    };
  }, []);
  return (
    <>
      <p role="status">
        {visible && config && status === "live"
          ? "Pup to date · Live updates connected"
          : "Regular refresh is active."}
      </p>
      {visible && config && userId && (
        <LiveUpdates
          key={userId}
          config={config}
          renew={() => client.call<LiveLists>("getLive", { userId })}
          onChange={() => {
            void queue.current?.notify();
          }}
          onStatus={setStatus}
          onTerminalError={terminal}
        />
      )}
    </>
  );
}
