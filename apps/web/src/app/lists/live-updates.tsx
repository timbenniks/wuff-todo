"use client";
import { useEffect, useRef, useState } from "react";
import {
  createRealtimeClient,
  type RealtimeClient,
} from "@neon/realtime/client";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import type { LiveLists } from "@/lib/live-types";
import { ApiError } from "@/lib/api";
import { useActorApi } from "./actor-api";

type Props = {
  config: LiveLists;
  userId: string;
  onChange: () => void;
  onStatus: (status: string) => void;
};
export function LiveUpdates(props: Props) {
  const [client, setClient] = useState<RealtimeClient | null>(null);
  useEffect(() => {
    // Effect ownership also creates a fresh client after React's Strict Mode
    // cleanup. A closed client must never be reused by a remount or new account.
    const current = createRealtimeClient({
      url: props.config.url,
      logLevel: "silent",
    });
    setClient(current);
    return () => current.close();
  }, [props.config.url]);
  return client ? (
    <RealtimeProvider client={client}>
      <Subscription {...props} />
    </RealtimeProvider>
  ) : null;
}
function Subscription({ config, userId, onChange, onStatus }: Props) {
  const api = useActorApi();
  const client = useRef({ onChange, onStatus });
  client.current = { onChange, onStatus };
  const [generation, setGeneration] = useState(0);
  const [query, setQuery] = useState(config.query);
  const stopped = useRef(false);
  const renew = async () => {
    const result = await api<LiveLists>("/api/v1/live", "POST", { userId });
    return result.query;
  };
  // A terminal SDK error needs a fresh query/subscription. Retry in the
  // background while the app's independent polling keeps data available.
  return (
    <Query
      key={generation}
      query={query}
      renew={renew}
      changed={() => client.current.onChange()}
      status={(status) => client.current.onStatus(status)}
      retry={async () => {
        if (stopped.current) return;
        try {
          setQuery(await renew());
          setGeneration((v) => v + 1);
        } catch (error) {
          if (
            error instanceof ApiError &&
            [401, 403, 409].includes(error.status)
          ) {
            stopped.current = true;
            window.location.replace("/lists");
          }
        }
      }}
    />
  );
}
function Query({
  query,
  renew,
  changed,
  status,
  retry,
}: {
  query: LiveLists["query"];
  renew: () => Promise<LiveLists["query"]>;
  changed: () => void;
  status: (status: string) => void;
  retry: () => Promise<void>;
}) {
  const callbacks = useRef({ changed, status, renew, retry });
  callbacks.current = { changed, status, renew, retry };
  const {
    data,
    status: state,
    error,
  } = useLiveQuery(query, {
    refreshQuery: async () => {
      try {
        return await callbacks.current.renew();
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 409].includes(error.status))
          window.location.replace("/lists");
        throw error;
      }
    },
  });
  useEffect(() => {
    callbacks.current.status(state);
    // Treat initial/reconnected snapshots as invalidations too. Fetching from
    // the API avoids rendering delayed replica rows over newer local writes.
    if (state === "live" && data !== undefined) callbacks.current.changed();
  }, [data, state]);
  useEffect(() => {
    if (state !== "error") return;
    const timer = setInterval(() => void callbacks.current.retry(), 10_000);
    return () => clearInterval(timer);
  }, [state, error]);
  return null;
}
