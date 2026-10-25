"use client";
import { LiveUpdates as SharedLiveUpdates } from "@wuff/ui/live-updates";
import type { LiveLists } from "@wuff/ui/live-types";
import { ApiError } from "@/lib/api";
import { useActorApi } from "@/platform/actor-api";
export function LiveUpdates(props: {
  config: LiveLists;
  userId: string;
  onChange: () => void;
  onStatus: (status: string) => void;
}) {
  const api = useActorApi();
  return (
    <SharedLiveUpdates
      config={props.config}
      onChange={props.onChange}
      onStatus={props.onStatus}
      renew={() =>
        api<LiveLists>("/api/v1/live", "POST", { userId: props.userId })
      }
      onTerminalError={(error) => {
        if (
          error instanceof ApiError &&
          [401, 403, 409].includes(error.status)
        ) {
          window.location.replace("/lists");
          return true;
        }
        return false;
      }}
    />
  );
}
