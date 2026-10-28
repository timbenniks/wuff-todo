import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  mcpToolAllowed,
  mcpToolSelectionAllowed,
  mcpToolCatalog,
  optionalMcpToolIds,
  scopes,
  selectMcpToolGroup,
  updateMcpToolsSchema,
  mcpToolAvailability,
  mcpToolGrantSummary,
} from "@wuff/contracts";
import { createMcpServer } from "../apps/web/src/lib/mcp";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { Client } = await import(
  require.resolve("@modelcontextprotocol/sdk/client/index.js")
);
const { InMemoryTransport } = await import(
  require.resolve("@modelcontextprotocol/sdk/inMemory.js")
);
test("selected Totake tools remain unavailable without the required consent", () => {
  const selected = ["get_totake", "update_totake", "get_task"];
  assert.deepEqual(
    mcpToolAvailability("get_totake", ["lists:read"], selected),
    {
      selected: true,
      available: false,
      missingScopes: ["totake:read"],
    },
  );
  assert.deepEqual(
    mcpToolAvailability("update_totake", ["totake:read"], selected),
    {
      selected: true,
      available: false,
      missingScopes: ["totake:write"],
    },
  );
  assert.equal(
    mcpToolAvailability("get_task", ["lists:read"], selected).available,
    true,
  );
  assert.equal(
    mcpToolAvailability("get_totake", ["totake:read"], selected).available,
    true,
  );
  assert.deepEqual(mcpToolAvailability("get_totake", ["totake:read"], []), {
    selected: false,
    available: false,
    missingScopes: [],
  });
  assert.equal(
    mcpToolAvailability("unknown", scopes, ["unknown"]).available,
    false,
  );
});
async function host(
  granted: readonly string[],
  selected: readonly string[] | null,
  run: (client: InstanceType<typeof Client>) => Promise<void>,
) {
  const server = createMcpServer(
    { id: "synthetic-unit-user", scopes: granted },
    selected,
  );
  const client = new Client({ name: "tool-policy-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a);
    await client.connect(b);
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}
test("mixed grants never establish the client's token permission; old-token discovery and invocation stay denied", async () => {
  const oldScopes = ["lists:read", "empire:read"];
  const newScopes = [...oldScopes, "totake:read", "totake:write"];
  const aggregate = [...new Set([...oldScopes, ...newScopes])];
  const selected = ["get_totake", "update_totake"];
  for (const id of selected) {
    assert.deepEqual(mcpToolGrantSummary(id, aggregate, selected), {
      selected: true,
      permission: "unverified",
      missingScopes: [],
    });
    assert.equal(mcpToolAvailability(id, oldScopes, selected).available, false);
    assert.equal(mcpToolAvailability(id, newScopes, selected).available, true);
  }
  await host(oldScopes, selected, async (client) => {
    const result = await client.listTools();
    assert(
      !result.tools.some((tool: { name: string }) =>
        selected.includes(tool.name),
      ),
    );
    for (const id of selected) {
      const denied = await client.callTool({ name: id, arguments: {} });
      assert(denied.isError);
    }
  });
  await host(newScopes, selected, async (client) => {
    const result = await client.listTools();
    for (const id of selected)
      assert(result.tools.some((tool: { name: string }) => tool.name === id));
  });
});
test("aggregate consent summaries handle missing, split, deselected and unknown tools without inferring authorization", () => {
  const selected = ["get_totake", "update_totake"];
  assert.deepEqual(
    mcpToolGrantSummary("get_totake", ["lists:read"], selected),
    {
      selected: true,
      permission: "missing_consent",
      missingScopes: ["totake:read"],
    },
  );
  assert.deepEqual(
    mcpToolGrantSummary("update_totake", ["totake:read"], selected),
    {
      selected: true,
      permission: "missing_consent",
      missingScopes: ["totake:write"],
    },
  );
  // No single grant has both scopes, even though their union does.
  const splitGrants = [["totake:read"], ["totake:write"]];
  assert(
    splitGrants.every(
      (grant) => !mcpToolAllowed("update_totake", grant, selected),
    ),
  );
  assert.equal(
    mcpToolGrantSummary("update_totake", splitGrants.flat(), selected)
      .permission,
    "unverified",
  );
  assert.deepEqual(mcpToolGrantSummary("get_totake", ["totake:read"], []), {
    selected: false,
    permission: "unverified",
    missingScopes: [],
  });
  assert.deepEqual(mcpToolGrantSummary("get_totake", [], []), {
    selected: false,
    permission: "missing_consent",
    missingScopes: ["totake:read"],
  });
  assert.deepEqual(mcpToolGrantSummary("unknown", scopes, ["unknown"]), {
    selected: false,
    permission: "unknown_tool",
    missingScopes: [],
  });
});
test("tool choices enforce scope ceilings, locked controls and unknown-tool denial", () => {
  assert(mcpToolAllowed("get_totake", ["totake:read"], null));
  assert(!mcpToolAllowed("get_totake", ["lists:read"], null));
  assert(!mcpToolAllowed("get_totake", scopes, []));
  assert(mcpToolAllowed("get_mcp_tool_preferences", ["empire:read"], []));
  assert(!mcpToolAllowed("update_mcp_tool_preferences", ["empire:read"], []));
  assert(!mcpToolAllowed("future_tool", scopes, null));
  for (const id of ["get_github_list", "get_github_task", "get_task_agent"])
    assert(mcpToolAllowed(id, ["lists:read"], null));
  assert(
    !mcpToolAllowed(
      "launch_task_agent",
      ["lists:read", "lists:manage", "agents:manage"],
      null,
    ),
  );
  assert(
    !mcpToolAllowed(
      "bind_github_repository",
      ["lists:read", "github:manage"],
      null,
    ),
  );
});
test("group switches preserve other services and individual choices", () => {
  const all = selectMcpToolGroup(["get_totake", "get_task"], "todo", true);
  assert(all.includes("create_task"));
  assert(all.includes("get_totake"));
  assert.deepEqual(selectMcpToolGroup(all, "todo", false), ["get_totake"]);
  assert.deepEqual(selectMcpToolGroup(["get_task"], "unknown", true), [
    "get_task",
  ]);
  assert(!selectMcpToolGroup([], "connections", true).length);
});
test("tool updates accept an empty selection and reject invalid/duplicate/control tools and spoofed identity", () => {
  const input = {
    clientId: "client",
    version: 0,
    operationId: crypto.randomUUID(),
    enabledTools: [],
  };
  assert(updateMcpToolsSchema.safeParse(input).success);
  for (const patch of [
    { enabledTools: ["get_task", "get_task"] },
    { enabledTools: ["future_tool"] },
    { enabledTools: ["disconnect_ai_client"] },
    { version: -1 },
    { operationId: "bad" },
    { userId: "another" },
    { mcpClientId: "spoof" },
  ])
    assert(!updateMcpToolsSchema.safeParse({ ...input, ...patch }).success);
});
test("actual MCP SDK discovery covers the full catalog and hides denied tools; cached calls cannot run", async () => {
  await host(scopes, null, async (client) => {
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((t: { name: string }) => t.name).sort(),
      mcpToolCatalog.map((t) => t.id).sort(),
    );
  });
  await host(scopes, ["get_task"], async (client) => {
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((t: { name: string }) => t.name).sort(),
      [
        "get_task",
        ...mcpToolCatalog.filter((t) => t.control).map((t) => t.id),
      ].sort(),
    );
    const denied = await client.callTool({ name: "get_totake", arguments: {} });
    assert(denied.isError);
    assert(JSON.stringify(denied).includes("disabled"));
  });
  await host(["lists:read"], null, async (client) => {
    const result = await client.listTools();
    assert(result.tools.some((t: { name: string }) => t.name === "get_task"));
    assert(
      !result.tools.some((t: { name: string }) =>
        ["create_task", "get_totake", "get_mcp_tool_preferences"].includes(
          t.name,
        ),
      ),
    );
  });
});

test("MCP actors can narrow but cannot re-enable any saved selection; owners can recover", () => {
  assert(mcpToolSelectionAllowed(null, ["get_totake"], true));
  assert(
    mcpToolSelectionAllowed(["get_task", "get_totake"], ["get_task"], true),
  );
  assert(mcpToolSelectionAllowed(["get_task"], ["get_task"], true));
  assert(mcpToolSelectionAllowed(["get_task"], [], true));
  assert(!mcpToolSelectionAllowed([], ["get_totake"], true));
  assert(
    !mcpToolSelectionAllowed(["get_task"], ["get_task", "get_totake"], true),
  );
  assert(mcpToolSelectionAllowed([], ["get_totake"], false));
});
