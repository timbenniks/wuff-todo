import WebSocket from "ws";
import {
  createRealtimeClient,
  type MaterializedLiveQuerySubscription,
  type LiveQuerySnapshot,
} from "@neon/realtime/client";
import type { ListSummary } from "@wuff/contracts";
// Node's WebSocket can linger during a close handshake. The documented Node
// transport provides terminate(), letting the SDK bound cleanup reliably.
const sockets = new Set<WebSocket>();
class TestWebSocket extends WebSocket {
  constructor(url: string, protocols?: string | string[]) {
    super(url, protocols);
    sockets.add(this);
    this.on("close", () => sockets.delete(this));
  }
}
globalThis.WebSocket = TestWebSocket as unknown as typeof globalThis.WebSocket;
export function disconnectLiveConnections() {
  for (const socket of sockets) socket.terminate();
}
export { createRealtimeClient };
export function waitForLive(
  subscription: MaterializedLiveQuerySubscription<ListSummary>,
  predicate: (rows: readonly ListSummary[]) => boolean,
  timeout = 8000,
) {
  return new Promise<void>((resolve, reject) => {
    let remove = () => {};
    const timer = setTimeout(() => {
      remove();
      reject(new Error("Live change did not arrive before timeout"));
    }, timeout);
    function check(state: LiveQuerySnapshot<ListSummary>) {
      if (state.status === "error") {
        clearTimeout(timer);
        remove();
        reject(new Error("Live subscription failed"));
      } else if (
        state.status === "live" &&
        state.data !== undefined &&
        predicate(state.data)
      ) {
        clearTimeout(timer);
        remove();
        resolve();
      }
    }
    remove = subscription.onChange(check);
    check(subscription.getSnapshot());
  });
}
