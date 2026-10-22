import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { createNativeSocket, type SocketEvent } from "./socket-adapter";
export function installNativeSocket() {
  if (!isTauri()) return;
  const { Socket, closeAll } = createNativeSocket({
    open(id, url, receive) {
      const events = new Channel<SocketEvent>();
      events.onmessage = receive;
      return invoke("live_open", { id, url, events });
    },
    send: (id, text) => invoke("live_send", { id, text }),
    close: (id) => invoke("live_close", { id }),
  });
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  window.addEventListener("pagehide", closeAll);
}
