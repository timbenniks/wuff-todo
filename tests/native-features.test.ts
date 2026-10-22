import { test } from "node:test";
import assert from "node:assert/strict";
import { featureApi } from "../apps/native/src/feature-api";
import { ImagePool, privateImageBlob } from "../apps/native/src/image-pool";
import { ApiError } from "../packages/ui/src/features/api";
import { ClientError } from "../packages/client/src/index";
test("native routes pin identity and preserve exact mutation payload on explicit retry", async () => {
  const calls: unknown[][] = [];
  const api = featureApi(
    {
      call: async (...args: unknown[]) => {
        calls.push(args);
        return {} as any;
      },
    },
    "actor",
  );
  const payload = {
    listId: "wrong",
    taskId: "task",
    version: 4,
    operationId: crypto.randomUUID(),
    content: "kept",
    references: [],
  };
  await api("/api/v1/tasks", "PATCH", payload);
  await api("/api/v1/tasks", "PATCH", payload);
  assert.deepEqual(calls[0], ["updateTask", payload, "actor"]);
  assert.deepEqual(calls[0], calls[1]);
  await api("/api/v1/lists/list-id/view", "PUT", {
    viewVersion: 3,
    view: { search: "hello" },
    operationId: "operation",
  });
  assert.deepEqual(calls[2], [
    "updateListView",
    {
      viewVersion: 3,
      view: { search: "hello" },
      operationId: "operation",
      listId: "list-id",
    },
    "actor",
  ]);
  await assert.rejects(
    api("https://other.example/api/v1/tasks", "POST", payload),
    ApiError,
  );
  await assert.rejects(
    api("/api/v1/agents", "POST", { action: "launch" }),
    ApiError,
  );
  assert.equal(calls.length, 3);
});
test("lost native mutation responses remain ambiguous for the shared retry UI", async () => {
  const api = featureApi({
    call: async () => {
      throw new ClientError("Connection lost");
    },
  });
  await assert.rejects(
    api("/api/v1/tasks", "POST", {}),
    (error) => error instanceof ClientError && !(error instanceof ApiError),
  );
});
test("private image resources deduplicate and revoke on last release or account exit", async () => {
  let calls = 0;
  const revoked: string[] = [];
  const pool = new ImagePool(
    async () => {
      calls++;
      return new Blob(["synthetic"], { type: "image/webp" });
    },
    {
      createObjectURL: () => `blob:${calls}`,
      revokeObjectURL: (url) => revoked.push(url),
    },
  );
  const [a, b] = await Promise.all([pool.acquire("one"), pool.acquire("one")]);
  assert.equal(calls, 1);
  a.release();
  assert.deepEqual(revoked, []);
  b.release();
  assert.deepEqual(revoked, ["blob:1"]);
  await pool.acquire("two");
  pool.clear();
  assert.deepEqual(revoked, ["blob:1", "blob:2"]);
  await assert.rejects(pool.acquire("three"));
});
test("sign-out during image download cannot create a late object URL", async () => {
  let resolve!: (blob: Blob) => void,
    created = 0;
  const pool = new ImagePool(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    {
      createObjectURL: () => {
        created++;
        return "blob:late";
      },
      revokeObjectURL: () => {},
    },
  );
  const request = pool.acquire("one");
  pool.clear();
  resolve(new Blob(["synthetic"], { type: "image/webp" }));
  await assert.rejects(request);
  assert.equal(created, 0);
});

test("native image decoding uses transport headers even when Response internal headers are empty", async () => {
  const response = new Response(new Uint8Array([1, 2, 3]));
  Object.defineProperty(response, "headers", {
    value: new Headers({ "content-type": "image/webp", "content-length": "3" }),
  });
  const blob = await privateImageBlob(response);
  assert.equal(blob.type, "image/webp");
  assert.equal(blob.size, 3);
});
