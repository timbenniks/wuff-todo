import { test } from "node:test";
import assert from "node:assert/strict";
import { ListCache } from "../packages/ui/src/modules/todo/lib/list-cache";
import type { TodoList } from "@wuff/contracts";

const snapshot = (version: number): TodoList => ({
  id: "list-a",
  title: "Synthetic list",
  ownerId: "synthetic-user",
  shared: false,
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
test("task and personal view snapshots cannot roll back each other's independent revision", async () => {
  const { defaultListView } = await import("@wuff/contracts");
  const cache = new ListCache({
    ...snapshot(2),
    personalView: {
      version: 3,
      view: { ...defaultListView(), sortBy: "priority" },
    },
  });
  cache.write({
    ...snapshot(3),
    personalView: { version: 2, view: defaultListView() },
  });
  assert.equal(cache.get("list-a")?.version, 3);
  assert.equal(cache.get("list-a")?.personalView?.version, 3);
  cache.write({
    ...snapshot(2),
    personalView: {
      version: 4,
      view: { ...defaultListView(), groupBy: "status" },
    },
  });
  assert.equal(cache.get("list-a")?.version, 3);
  assert.equal(cache.get("list-a")?.personalView?.view.groupBy, "status");
});

test("inactive cache retention is bounded and evicted in-flight reads cannot reappear", async () => {
  const cache = new ListCache(null, 2);
  cache.write({ ...snapshot(1), id: "a" });
  cache.write({ ...snapshot(1), id: "b" });
  const delayed = deferred<TodoList>();
  const loading = cache.load("a", () => delayed.promise);
  cache.get("b");
  cache.write({ ...snapshot(1), id: "c" });
  assert.equal(cache.get("a"), null);
  delayed.resolve({ ...snapshot(2), id: "a" });
  assert.equal(await loading, null);
  assert.equal(cache.get("a"), null);
  assert.ok(cache.get("b"));
  assert.ok(cache.get("c"));
});
