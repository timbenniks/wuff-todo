"use client";
import { useEffect, useRef, useState } from "react";
import {
  createRealtimeClient,
  type RealtimeClient,
} from "@neon/realtime/client";
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import type { LiveLists } from "./live-types";

type Props = {
  config: LiveLists;
  renew: () => Promise<LiveLists>;
  onTerminalError: (error: unknown) => boolean;
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
function Subscription({
  config,
  renew: renewConfig,
  onChange,
  onStatus,
  onTerminalError,
}: Props) {
  const client = useRef({ onChange, onStatus, renewConfig, onTerminalError });
  client.current = { onChange, onStatus, renewConfig, onTerminalError };
  const [generation, setGeneration] = useState(0);
  const [query, setQuery] = useState(config.query);
  const stopped = useRef(false);
  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, []);
  const renew = async () => {
    try {
      return (await client.current.renewConfig()).query;
    } catch (error) {
      if (!stopped.current && client.current.onTerminalError(error))
        stopped.current = true;
      throw error;
    }
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
          const next = await renew();
          if (!stopped.current) {
            setQuery(next);
            setGeneration((v) => v + 1);
          }
        } catch (error) {
          // Renewal handles terminal auth failures; polling remains independent.
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
    refreshQuery: () => callbacks.current.renew(),
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
