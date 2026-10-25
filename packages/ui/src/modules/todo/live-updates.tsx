"use client";
import { useEffect, useRef, useState } from "react";
import { LiveUpdates as Subscription } from "../../live-updates";
import type { LiveLists } from "../../live-types";
import { ApiError } from "../../features/api";
import { useRuntime } from "../../features/runtime";
export function LiveUpdates(props: {
  config: LiveLists | null;
  userId: string;
  onChange: () => void;
  onStatus: (status: string) => void;
}) {
  const runtime = useRuntime();
  const [config, setConfig] = useState<LiveLists | null>(props.config);
  const configRef = useRef(config);
  configRef.current = config;
  const current = useRef(props);
  current.current = props;
  useEffect(() => {
    if (!runtime.native) return;
    let active = true,
      generation = 0,
      acquiring = false;
    const acquire = async () => {
      if (document.hidden || acquiring || !active) return;
      const epoch = ++generation;
      acquiring = true;
      try {
        const next = await runtime.api<LiveLists>("/api/v1/live", "POST", {
          userId: current.current.userId,
        });
        if (active && epoch === generation && !document.hidden) {
          configRef.current = next;
          setConfig(next);
        }
      } catch (error) {
        if (
          active &&
          error instanceof ApiError &&
          [401, 403, 409].includes(error.status)
        )
          runtime.reset();
      } finally {
        acquiring = false;
      }
    };
    const visibility = () => {
      if (document.hidden) {
        generation++;
        configRef.current = null;
        setConfig(null);
        current.current.onStatus("connecting");
      } else void acquire();
    };
    if (!configRef.current) void acquire();
    const timer = setInterval(() => {
      if (!configRef.current) void acquire();
    }, 10_000);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [runtime]);
  return config ? (
    <Subscription
      config={config}
      onChange={props.onChange}
      onStatus={props.onStatus}
      renew={() =>
        runtime.api("/api/v1/live", "POST", { userId: props.userId })
      }
      onTerminalError={(error) => {
        if (
          error instanceof ApiError &&
          [401, 403, 409].includes(error.status)
        ) {
          runtime.reset();
          return true;
        }
        return false;
      }}
    />
  ) : null;
}
