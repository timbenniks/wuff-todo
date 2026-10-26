"use client";
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
  return props.config ? (
    <Subscription
      config={props.config}
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
