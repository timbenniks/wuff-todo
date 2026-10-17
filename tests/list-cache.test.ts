import { test } from "node:test";
import assert from "node:assert/strict";
import { ListCache } from "../apps/web/src/lib/list-cache";
import type { TodoList } from "@wuff/contracts";

const snapshot = (version: number): TodoList => ({
  id: "list-a",
  title: "Synthetic list",
  ownerId: "synthetic-user",
  version,
  color: "blue",
  mode: "simple",
  assignees: [],
  description: "",
  archived: false,
  sections: [],
  tasks: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test("visited snapshots are immediate and simultaneous hover/click reads deduplicate", async () => {
  const cache = new ListCache(snapshot(1));
  assert.equal(cache.get("list-a")?.version, 1);
  const request = deferred<TodoList>();
  let calls = 0;
  const fetcher = () => {
    calls++;
    return request.promise;
  };
  const hover = cache.load("list-a", fetcher);
  const click = cache.load("list-a", fetcher);
  assert.equal(calls, 1);
  assert.equal(
    cache.get("list-a")?.version,
    1,
    "Keep content visible while checking freshness",
  );
  request.resolve(snapshot(2));
  assert.equal((await hover)?.version, 2);
  assert.equal((await click)?.version, 2);
});
test("a delayed read cannot replace a newer mutation result", async () => {
  const cache = new ListCache(snapshot(1));
  const request = deferred<TodoList>();
  const read = cache.load("list-a", () => request.promise);
  cache.supersede("list-a");
  cache.write(snapshot(3));
  request.resolve(snapshot(1));
  assert.equal((await read)?.version, 3);
  assert.equal(cache.get("list-a")?.version, 3);
  await cache.load("list-a", async () => snapshot(2));
  assert.equal(cache.get("list-a")?.version, 3);
});
test("deleted/revoked snapshots and signed-out users cannot be restored by old reads", async () => {
  const cache = new ListCache(snapshot(1));
  const request = deferred<TodoList>();
  const read = cache.load("list-a", () => request.promise);
  cache.forget("list-a");
  request.resolve(snapshot(1));
  assert.equal(await read, null);
  const other = deferred<TodoList>();
  const beforeLogout = cache.load("list-a", () => other.promise);
  cache.clear();
  other.resolve(snapshot(2));
  assert.equal(await beforeLogout, null);
  assert.equal(cache.get("list-a"), null);
});
test("a failed read can be retried and does not erase the last known content", async () => {
  const cache = new ListCache(snapshot(1));
  await assert.rejects(
    cache.load("list-a", async () => {
      throw Error("Synthetic network failure");
    }),
  );
  assert.equal(cache.get("list-a")?.version, 1);
  assert.equal(
    (await cache.load("list-a", async () => snapshot(2)))?.version,
    2,
  );
});
