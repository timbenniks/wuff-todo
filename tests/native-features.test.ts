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

test("native reminder controls use bearer operations and preserve personal revisions", async () => {
  const calls: unknown[][] = [];
  const api = featureApi(
    {
      call: async (...args: unknown[]) => {
        calls.push(args);
        return {} as any;
      },
    },
    "reminder-actor",
  );
  await api("/api/v1/reminders");
  await api("/api/v1/reminders?listId=list-id");
  await api("/api/v1/reminders?listId=list-id&taskId=task-id");
  const input = {
    listId: "list-id",
    taskId: "task-id",
    version: 7,
    runAt: "2026-10-23T09:00:00Z",
    operationId: crypto.randomUUID(),
  };
  await api("/api/v1/reminders", "POST", { action: "task", input });
  await api("/api/v1/reminders", "POST", { action: "task", input });
  const local = { local: "2026-10-23T09:00", timezone: "Europe/Paris" };
  await api("/api/v1/reminders", "POST", { action: "localTime", input: local });
  assert.deepEqual(calls, [
    ["getReminderSettings", undefined, "reminder-actor"],
    ["getListReminders", { listId: "list-id" }, "reminder-actor"],
    [
      "getTaskReminder",
      { listId: "list-id", taskId: "task-id" },
      "reminder-actor",
    ],
    ["setTaskReminder", input, "reminder-actor"],
    ["setTaskReminder", input, "reminder-actor"],
    ["resolveReminderLocalTime", local, "reminder-actor"],
  ]);
  await assert.rejects(
    api("/api/v1/reminders", "POST", { action: "unknown", input: {} }),
    ApiError,
  );
  await assert.rejects(
    api("/api/v1/reminders/arbitrary", "POST", { action: "task", input }),
    ApiError,
  );
  assert.equal(calls.length, 6);
});

test("GitHub consent survives old live 401 responses without triggering session reset", async () => {
  const { NativeClient } = await import("../packages/client/src/index");
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }
  const live = deferred<Response>(),
    liveStarted = deferred<void>();
  const token = deferred<Response>(),
    tokenStarted = deferred<void>();
  let saved = {
    accessToken: "basic",
    refreshToken: "basic-refresh",
    expiresAt: Date.now() + 900000,
  };
  let signouts = 0;
  const client = new NativeClient(
    "https://wuff.example",
    {
      read: async () => saved,
      write: async (value) => {
        saved = value;
      },
      clear: async () => {
        throw new Error("A stale live request must not clear the session");
      },
    },
    async (url, init) => {
      if (String(url).endsWith("/oauth/token")) {
        tokenStarted.resolve();
        return token.promise;
      }
      if (String(url).endsWith("/oauth/revoke")) return new Response(null);
      const action = JSON.parse(String(init?.body)).action;
      if (action === "getLive") {
        liveStarted.resolve();
        return live.promise;
      }
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer upgraded",
      );
      return Response.json([]);
    },
  );
  client.onSignedOut = () => {
    signouts++;
  };
  await client.restore();
  const api = featureApi(client, "actor");
  const read = assert.rejects(
    api("/api/v1/live", "POST", { userId: "actor" }),
    (error: unknown) => {
      assert.ok(
        !(error instanceof ApiError),
        "Superseded requests must not be classified as terminal authentication errors",
      );
      assert.equal((error as ClientError).code, "request_superseded");
      return true;
    },
  );
  await liveStarted.promise;
  const upgrade = client.exchange("consent-code", "verifier");
  await tokenStarted.promise;
  await assert.rejects(
    api("/api/v1/lists"),
    (e: ClientError) => e.code === "request_superseded",
  );
  live.resolve(
    Response.json({ error: { code: "unauthorized" } }, { status: 401 }),
  );
  await read;
  token.resolve(
    Response.json({
      access_token: "upgraded",
      refresh_token: "upgraded-refresh",
      expires_in: 900,
    }),
  );
  await upgrade;
  await api("/api/v1/lists");
  assert.equal(signouts, 0);
  assert.equal(saved.refreshToken, "upgraded-refresh");
});

test("Totake and notification routes use account-pinned native calls and reject unsupported mutations", async () => {
  const calls: unknown[] = [];
  const api = featureApi(
    {
      call: async (...args: unknown[]) => {
        calls.push(args);
        return {} as never;
      },
    },
    "totake-actor",
  );
  const payload = {
    version: 2,
    operationId: "stable-operation",
    change: {
      action: "record",
      groupId: "group",
      itemIds: ["item"],
      outcome: "taken",
    },
  };
  await api("/api/v1/totake");
  await api("/api/v1/totake", "PUT", payload);
  await api("/api/v1/notifications");
  await api("/api/v1/totake?day=21000");
  assert.deepEqual(calls, [
    ["getTotake", {}, "totake-actor"],
    ["updateTotake", payload, "totake-actor"],
    ["getNotificationSettings", {}, "totake-actor"],
    ["getTotake", { day: 21000 }, "totake-actor"],
  ]);
  await assert.rejects(api("/api/v1/totake", "DELETE", payload), ApiError);
  await assert.rejects(api("https://other.example/api/v1/totake"), ApiError);
});
