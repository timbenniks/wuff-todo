import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NativeClient,
  PendingMutation,
  ClientError,
  serverOrigin,
  type NativeTokens,
} from "../packages/client/src/index";
import {
  validResourceClient,
  nativeClientId,
  nativeRedirectUri,
} from "../apps/web/src/lib/native-policy";
import { validateRedirectUri } from "../apps/web/src/lib/oauth";
const origin = "https://wuff.example";
const fresh = () => ({
  accessToken: "synthetic-access",
  refreshToken: "synthetic-refresh",
  expiresAt: Date.now() + 900_000,
});
function memory(value: NativeTokens | null = fresh()) {
  return {
    value,
    async read() {
      return this.value;
    },
    async write(tokens: NativeTokens) {
      this.value = tokens;
    },
    async clear() {
      this.value = null;
    },
  };
}
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
test("native tokens have their own audience and custom callback is not dynamically registrable", () => {
  assert.ok(
    validResourceClient(nativeClientId, origin + "/api/mobile", origin),
  );
  assert.equal(
    validResourceClient(nativeClientId, origin + "/api/mcp", origin),
    false,
  );
  assert.equal(
    validResourceClient("external-client", origin + "/api/mobile", origin),
    false,
  );
  assert.ok(
    validResourceClient("external-client", origin + "/api/mcp", origin),
  );
  assert.equal(validateRedirectUri(nativeRedirectUri), false);
  for (const value of [
    "http://remote.example",
    "https://user:password@wuff.example",
    "https://wuff.example/path",
    "https://wuff.example#token",
  ])
    assert.throws(() => serverOrigin(value));
  assert.equal(serverOrigin("http://localhost:3000"), "http://localhost:3000");
});
test("parallel native reads share one rotating refresh and never use browser cookies", async () => {
  const store = memory({ ...fresh(), expiresAt: 0 });
  let refreshes = 0;
  const client = new NativeClient(origin, store, async (url, init) => {
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "error");
    if (String(url).endsWith("/oauth/token")) {
      refreshes++;
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get("resource"), origin + "/api/mobile");
      return Response.json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 900,
      });
    }
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer rotated-access",
    );
    return Response.json([]);
  });
  await client.restore();
  await Promise.all([client.lists(), client.lists(), client.lists()]);
  assert.equal(refreshes, 1);
  assert.equal(store.value?.refreshToken, "rotated-refresh");
});
test("interactive native consent cannot be overwritten by a late basic-grant refresh", async () => {
  const store = memory({ ...fresh(), expiresAt: 0 });
  const refreshResponse = deferred<Response>(),
    refreshStarted = deferred<void>();
  const revoked: string[] = [];
  const client = new NativeClient(origin, store, async (url, init) => {
    const params = new URLSearchParams(String(init?.body));
    if (String(url).endsWith("/oauth/revoke")) {
      revoked.push(params.get("token")!);
      return new Response(null, { status: 200 });
    }
    if (params.get("grant_type") === "refresh_token") {
      refreshStarted.resolve();
      return refreshResponse.promise;
    }
    if (params.get("grant_type") === "authorization_code")
      return Response.json({
        access_token: "consented-access",
        refresh_token: "consented-refresh",
        expires_in: 900,
      });
    assert.equal(
      (init!.headers as Record<string, string>).Authorization,
      "Bearer consented-access",
    );
    return Response.json([]);
  });
  await client.restore();
  const lateRead = assert.rejects(client.lists(), /cancelled|changed/i);
  await refreshStarted.promise;
  await client.exchange("new-explicit-consent", "synthetic-verifier");
  refreshResponse.resolve(
    Response.json({
      access_token: "late-basic",
      refresh_token: "late-basic-refresh",
      expires_in: 900,
    }),
  );
  await lateRead;
  await client.lists();
  assert.equal(store.value?.refreshToken, "consented-refresh");
  assert.ok(revoked.includes("synthetic-refresh"));
  assert.ok(revoked.includes("late-basic-refresh"));
});
test("sign-out discards a response arriving during JSON parsing", async () => {
  const store = memory(),
    payload = deferred<unknown>();
  const entered = deferred<void>();
  const client = new NativeClient(
    origin,
    store,
    async () =>
      ({
        ok: true,
        json: async () => {
          entered.resolve();
          return payload.promise;
        },
      }) as Response,
  );
  await client.restore();
  const request = client.lists();
  await entered.promise;
  await client.clear();
  payload.resolve([{ title: "private synthetic data" }]);
  await assert.rejects(
    request,
    (e: ClientError) => e.code === "request_superseded",
  );
  assert.equal(store.value, null);
});
test("sign-out during refresh cannot restore credentials and revokes the late token", async () => {
  const store = memory({ ...fresh(), expiresAt: 0 }),
    response = deferred<Response>(),
    entered = deferred<void>();
  let revocations = 0;
  const client = new NativeClient(origin, store, async (url) => {
    if (String(url).endsWith("/oauth/revoke")) {
      revocations++;
      return new Response(null);
    }
    entered.resolve();
    return response.promise;
  });
  await client.restore();
  const request = client.lists();
  await entered.promise;
  await client.clear();
  response.resolve(
    Response.json({
      access_token: "late-access",
      refresh_token: "late-refresh",
      expires_in: 900,
    }),
  );
  await assert.rejects(request);
  assert.equal(store.value, null);
  assert.equal(revocations, 1);
});
test("invalid refresh grants remove the local session", async () => {
  const store = memory({ ...fresh(), expiresAt: 0 });
  const client = new NativeClient(origin, store, async () =>
    Response.json({ error: "invalid_grant" }, { status: 400 }),
  );
  await client.restore();
  await assert.rejects(client.lists());
  assert.equal(store.value, null);
});
test("failed secure storage revokes new credentials and fails closed", async () => {
  const store = memory({ ...fresh(), expiresAt: 0 });
  let revoked = false;
  store.write = async () => {
    throw new Error("synthetic keychain failure");
  };
  const client = new NativeClient(origin, store, async (url) => {
    if (String(url).endsWith("/oauth/revoke")) {
      revoked = true;
      return new Response(null);
    }
    return Response.json({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 900,
    });
  });
  await client.restore();
  await assert.rejects(client.lists());
  assert.equal(store.value, null);
  assert.ok(revoked);
});
test("network ambiguity retains exact version and operation ID until explicit retry", async () => {
  const calls: unknown[] = [];
  let attempts = 0;
  const pending = new PendingMutation({
    async call<T>(_action: string, input?: unknown) {
      calls.push(input);
      if (++attempts === 1) throw new ClientError("Response lost");
      return { saved: true } as T;
    },
  });
  const input = {
    title: "Synthetic task",
    operationId: "same-operation",
    version: 2,
  };
  await assert.rejects(pending.run("createTask", input));
  input.version = 999;
  assert.ok(pending.hasPending);
  await assert.rejects(pending.run("createTask", {}));
  await pending.retry();
  assert.deepEqual(calls[0], calls[1]);
  assert.equal((calls[1] as typeof input).version, 2);
  assert.equal(pending.hasPending, false);
});
test("stale-version conflicts release the pending operation for an explicit new edit", async () => {
  const pending = new PendingMutation({
    async call() {
      throw new ClientError("List changed", 409, "conflict");
    },
  });
  await assert.rejects(pending.run("updateTask", {}));
  assert.equal(pending.hasPending, false);
});
test("sign-out still revokes the server grant when secure storage deletion fails", async () => {
  const store = memory();
  store.clear = async () => {
    throw new Error("synthetic deletion failure");
  };
  let revoked = false;
  const client = new NativeClient(origin, store, async () => {
    revoked = true;
    return new Response(null);
  });
  await client.restore();
  await assert.rejects(client.signOut(), /couldn’t remove saved sign-in/);
  assert.ok(revoked);
  await assert.rejects(client.lists(), (e: ClientError) => e.status === 401);
});

test("configured Tauri identity is used for exchange, refresh and revoke", async () => {
  const { tauriClientId, tauriRedirectUri } = await import("@wuff/contracts");
  const store = memory(null);
  const grants: string[] = [];
  const client = new NativeClient(
    origin,
    store,
    async (url, init) => {
      if (String(url).endsWith("/api/mobile")) return Response.json([]);
      const params = new URLSearchParams(String(init?.body));
      assert.equal(params.get("client_id"), tauriClientId);
      if (String(url).endsWith("/oauth/revoke")) return new Response(null);
      grants.push(params.get("grant_type")!);
      if (params.get("grant_type") === "authorization_code")
        assert.equal(params.get("redirect_uri"), tauriRedirectUri);
      assert.equal(params.get("resource"), origin + "/api/mobile");
      return Response.json({
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
        expires_in: 1,
      });
    },
    { clientId: tauriClientId, redirectUri: tauriRedirectUri },
  );
  await client.exchange("synthetic-code", "synthetic-verifier");
  await client.lists();
  await client.signOut();
  assert.deepEqual(grants, ["authorization_code", "refresh_token"]);
  assert.equal(store.value, null);
});

test("a rejected old refresh is nonterminal after interactive consent replaces its grant", async () => {
  const store = memory({ ...fresh(), expiresAt: 0 });
  const old = deferred<Response>(),
    started = deferred<void>();
  const client = new NativeClient(origin, store, async (url, init) => {
    const params = new URLSearchParams(String(init?.body));
    if (String(url).endsWith("/oauth/revoke")) return new Response(null);
    if (params.get("grant_type") === "refresh_token") {
      started.resolve();
      return old.promise;
    }
    if (params.get("grant_type") === "authorization_code")
      return Response.json({
        access_token: "new",
        refresh_token: "new-refresh",
        expires_in: 900,
      });
    return Response.json([]);
  });
  await client.restore();
  const read = assert.rejects(
    client.lists(),
    (e: ClientError) => e.code === "request_superseded" && e.status === 0,
  );
  await started.promise;
  await client.exchange("code", "verifier");
  old.resolve(Response.json({ error: "invalid_grant" }, { status: 400 }));
  await read;
  assert.equal(store.value?.refreshToken, "new-refresh");
  await client.lists();
});
