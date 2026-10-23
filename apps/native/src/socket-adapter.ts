export type SocketEvent = {
  type: "open" | "text" | "error" | "close";
  data?: string;
};
export type SocketBridge = {
  open(
    id: string,
    url: string,
    receive: (event: SocketEvent) => void,
  ): Promise<void>;
  send(id: string, text: string): Promise<void>;
  close(id: string): Promise<void>;
};
export function createNativeSocket(bridge: SocketBridge) {
  const active = new Set<NativeSocket>();
  // The SDK currently uses the global WebSocket constructor. This app-local
  // adapter keeps its protocol/renewal logic while Rust restricts network access.
  class NativeSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    private id = crypto.randomUUID();
    private opened: Promise<void>;
    private sending = Promise.resolve();
    constructor(
      readonly url: string | URL,
      protocols?: string | string[],
    ) {
      super();
      if (protocols !== "neon.realtime.v1")
        throw new Error("Unsupported live protocol");
      active.add(this);
      const receive = (event: SocketEvent) => {
        if (this.readyState === 3) return;
        if (event.type === "open") {
          if (this.readyState === 2) return;
          this.readyState = 1;
          this.dispatchEvent(new Event("open"));
        } else if (event.type === "text" && this.readyState === 1)
          this.dispatchEvent(new MessageEvent("message", { data: event.data }));
        else if (event.type === "error") this.fail();
        else if (event.type === "close") this.finish();
      };
      this.opened = bridge.open(this.id, String(url), receive);
      void this.opened.catch(() => this.fail());
    }
    send(data: string) {
      if (this.readyState !== 1 || typeof data !== "string")
        throw new Error("Live connection is not open");
      // IPC completion ordering must not reorder protocol messages.
      this.sending = this.sending.then(() => bridge.send(this.id, data));
      void this.sending.catch(() => this.fail());
    }
    close() {
      if (this.readyState >= 2) return;
      this.readyState = 2;
      void this.opened
        .then(() => bridge.close(this.id))
        .catch(() => {})
        .finally(() => this.finish());
    }
    private fail() {
      if (this.readyState === 3) return;
      this.dispatchEvent(new Event("error"));
      this.close();
    }
    private finish() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      active.delete(this);
      this.dispatchEvent(new Event("close"));
    }
  }
  return {
    Socket: NativeSocket,
    closeAll: () => {
      for (const socket of active) socket.close();
    },
  };
}
