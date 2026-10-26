import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyEmpireChanges,
  empireAppPreference,
  updateEmpireSettingsSchema,
  disconnectAiClientSchema,
  summarizeAiConnections,
} from "@wuff/contracts";
import { authorizationScopes } from "../apps/web/src/lib/oauth";
const retiredClientId = "wuff-tauri-v1";

test("Empire defaults preserve Todo and keep the new private Totake summary opt-in", () => {
  assert.deepEqual(empireAppPreference({}, "todo"), {
    visible: true,
    dashboard: true,
  });
  assert.deepEqual(empireAppPreference({}, "totake"), {
    visible: true,
    dashboard: false,
  });
  assert.equal(
    updateEmpireSettingsSchema.safeParse({
      version: 0,
      operationId: crypto.randomUUID(),
      changes: [{ appId: "totake", dashboard: true }],
    }).success,
    true,
  );
});
test("personal patches preserve omitted fields, other apps and unknown future settings without mutating the source", () => {
  const apps = {
    todo: { visible: true, dashboard: false },
    future: { visible: false, dashboard: false },
  };
  const before = structuredClone(apps);
  assert.deepEqual(
    applyEmpireChanges(apps, [
      { appId: "todo", visible: false, dashboard: undefined },
    ]),
    { todo: { visible: false, dashboard: false }, future: apps.future },
  );
  assert.deepEqual(apps, before);
  assert.deepEqual(
    applyEmpireChanges({}, [{ appId: "todo", visible: false }]).todo,
    { visible: false, dashboard: true },
  );
});
test("visibility writes reject unknown IDs, duplicate app changes, empty writes, invalid versions and unexpected permissions", () => {
  for (const change of [
    [],
    [{ appId: "unknown", visible: false }],
    [{ appId: "todo" }],
    [
      { appId: "todo", visible: false },
      { appId: "todo", dashboard: false },
    ],
    [{ appId: "todo", visible: "yes" }],
    [{ appId: "todo", enabled: true }],
    [{ appId: "todo", visible: false, scopes: ["totake:read"] }],
  ])
    assert.equal(
      updateEmpireSettingsSchema.safeParse({
        version: 0,
        operationId: crypto.randomUUID(),
        changes: change,
      }).success,
      false,
    );
  for (const version of [-1, 0.5, "1"])
    assert.equal(
      updateEmpireSettingsSchema.safeParse({
        version,
        operationId: crypto.randomUUID(),
        changes: [{ appId: "todo", visible: false }],
      }).success,
      false,
    );
});
test("new Empire permissions require explicit OAuth consent; old defaults remain unchanged and native clients are retired", () => {
  const client = crypto.randomUUID();
  assert.deepEqual(authorizationScopes(null, client), [
    "lists:read",
    "tasks:write",
    "lists:manage",
  ]);
  assert.deepEqual(authorizationScopes("empire:read empire:manage", client), [
    "empire:read",
    "empire:manage",
  ]);
  assert.throws(() => authorizationScopes("empire:manage", client));
  assert.deepEqual(authorizationScopes("totake:read totake:write", client), [
    "totake:read",
    "totake:write",
  ]);
  assert.deepEqual(
    authorizationScopes("notifications:read notifications:manage", client),
    ["notifications:read", "notifications:manage"],
  );
  assert.throws(() => authorizationScopes("totake:write", client));
  assert.throws(() => authorizationScopes("totake:read totake:manage", client));
  assert.throws(() => authorizationScopes("empire:read", retiredClientId));
  assert.throws(
    () =>
      authorizationScopes(
        "lists:read empire:read empire:manage",
        retiredClientId,
      ),
    { code: "invalid_client" },
  );
});
test("AI connection summaries deduplicate live grants and do not present expired scopes as active authority", () => {
  const rows = [
    { id: "a", name: "Alpha", scopes: ["lists:read"], expiresAt: 200 },
    {
      id: "a",
      name: "Alpha",
      scopes: ["empire:read", "lists:read"],
      expiresAt: 300,
    },
    { id: "a", name: "Alpha", scopes: ["github:manage"], expiresAt: 99 },
    { id: "b", name: "Beta", scopes: ["tasks:write"], expiresAt: 100 },
  ];
  assert.deepEqual(summarizeAiConnections(rows, 100), [
    {
      id: "a",
      name: "Alpha",
      scopes: ["empire:read", "lists:read"],
      state: "authorized",
    },
    { id: "b", name: "Beta", scopes: [], state: "expired" },
  ]);
  assert.deepEqual(summarizeAiConnections([], 100), []);
});
test("connection revocation supports fixed native client IDs as well as dynamic UUID clients", () => {
  for (const clientId of [retiredClientId, crypto.randomUUID()])
    assert(
      disconnectAiClientSchema.safeParse({
        clientId,
        operationId: crypto.randomUUID(),
      }).success,
    );
  for (const value of [
    { clientId: "" },
    { clientId: "x", operationId: "bad" },
    { clientId: "x", userId: "another-account" },
  ])
    assert(!disconnectAiClientSchema.safeParse(value).success);
});
