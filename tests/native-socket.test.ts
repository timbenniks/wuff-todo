import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNativeSocket,
  type SocketEvent,
} from "../apps/native/src/socket-adapter";
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  let receive!: (event: SocketEvent) => void;
  let opened!: () => void;
  let release!: () => void;
  const sent: string[] = [],
    closed: string[] = [];
  const adapter = createNativeSocket({
    open: async (_id, _url, callback) => {
      receive = callback;
      await new Promise<void>((resolve) => {
        opened = resolve;
      });
    },
    send: async (_id, text) => {
      sent.push(text);
      if (text === "first")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    },
    close: async (id) => {
      closed.push(id);
    },
  });
  const socket = new adapter.Socket(
    "wss://synthetic.example",
    "neon.realtime.v1",
  );
  return {
    ...adapter,
    socket,
    sent,
    closed,
    receive: (e: SocketEvent) => receive(e),
    open: () => opened(),
    release: () => release(),
  };
}
test("closing during IPC setup closes the native socket and ignores late frames", async () => {
  const f = fixture();
  let messages = 0,
    closes = 0;
  f.socket.addEventListener("message", () => messages++);
  f.socket.addEventListener("close", () => closes++);
  f.socket.close();
  f.receive({ type: "open" });
  f.receive({ type: "text", data: "late" });
  assert.equal(f.socket.readyState, 2);
  assert.equal(f.closed.length, 0);
  f.open();
  await tick();
  assert.equal(f.closed.length, 1);
  assert.equal(f.socket.readyState, 3);
  f.receive({ type: "text", data: "later" });
  f.receive({ type: "close" });
  assert.equal(messages, 0);
  assert.equal(closes, 1);
});
test("protocol writes stay ordered and page cleanup closes active connections", async () => {
  const f = fixture();
  assert.throws(() => f.socket.send("before open"));
  assert.throws(() => new f.Socket("wss://synthetic.example", "other"));
  f.open();
  f.receive({ type: "open" });
  f.socket.send("first");
  f.socket.send("second");
  await tick();
  assert.deepEqual(f.sent, ["first"]);
  f.release();
  await tick();
  assert.deepEqual(f.sent, ["first", "second"]);
  f.closeAll();
  await tick();
  assert.equal(f.closed.length, 1);
});
test("transport failure emits one error and closes without delivering stale data", async () => {
  const f = fixture();
  let errors = 0;
  f.socket.addEventListener("error", () => errors++);
  f.open();
  f.receive({ type: "error" });
  await tick();
  f.receive({ type: "error" });
  assert.equal(errors, 1);
  assert.equal(f.socket.readyState, 3);
});
