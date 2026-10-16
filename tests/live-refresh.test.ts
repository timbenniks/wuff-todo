import { test } from "node:test";
import assert from "node:assert/strict";
import { LiveRefreshQueue } from "../apps/web/src/lib/live-refresh";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
test("live events during a local write wait, then coalesce into a fresh read", async () => {
  let writing = true,
    calls = 0;
  const queue = new LiveRefreshQueue(
    async () => {
      calls++;
    },
    () => writing,
  );
  await queue.notify();
  await queue.notify();
  assert.equal(calls, 0);
  writing = false;
  await queue.flush();
  assert.equal(calls, 1);
});
test("a live event arriving during a read cannot be lost behind that stale read", async () => {
  const first = deferred();
  let calls = 0;
  const queue = new LiveRefreshQueue(
    async () => {
      calls++;
      if (calls === 1) await first.promise;
    },
    () => false,
  );
  const draining = queue.notify();
  await queue.notify();
  await queue.notify();
  assert.equal(calls, 1);
  first.resolve();
  await draining;
  assert.equal(calls, 2);
});
test("failed reads can retry and a stopped user's queue cannot fetch again", async () => {
  let calls = 0;
  const queue = new LiveRefreshQueue(
    async () => {
      calls++;
      if (calls === 1) throw Error("network unavailable");
    },
    () => false,
  );
  await queue.notify();
  await queue.notify();
  assert.equal(calls, 2);
  queue.stop();
  await queue.notify();
  assert.equal(calls, 2);
});
