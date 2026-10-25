import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "@wuff/db/schema";
import {
  empireModules,
  createModuleRegistry,
  moduleForPath,
  type EmpireModule,
  empireAppPreference,
  applyEmpireChanges,
  mcpToolAllowed,
  mcpToolCatalog,
} from "@wuff/contracts";
import { empireDestination } from "../apps/web/src/lib/empire";
import {
  createMcpContext,
  scopeModuleMcpContext,
} from "../apps/web/src/lib/mcp-context";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { McpServer } = await import(
  require.resolve("@modelcontextprotocol/sdk/server/mcp.js")
);
const sample = (): EmpireModule => ({
  permissions: [{ scope: "sample:read", label: "Read sample" }],
  id: "sample",
  name: "Sample",
  href: "/sample",
  settingsHref: "/settings/sample",
  status: "available",
  hasDashboard: true,
  description: "Synthetic module",
  routes: ["/sample"],
  defaults: { visible: true, dashboard: false },
  settings: [["/settings/sample", "Overview"]],
  dashboard: [{ id: "sample.summary" }],
  theme: "blue",
  mcpGroups: [{ id: "sample", title: "Sample", order: 80 }],
  mcpTools: [
    {
      id: "get_sample",
      group: "sample",
      title: "Read sample",
      scopes: ["sample:read"],
      control: false,
    },
  ],
});
test("module registration accepts an additional product and resolves exact/nested paths without prefix collisions", () => {
  const added = sample();
  const registry = createModuleRegistry([...empireModules, added]);
  assert.equal(moduleForPath(registry, "/sample/record/123"), added);
  assert.equal(moduleForPath(registry, "/sample-other"), undefined);
  assert.equal(moduleForPath(registry, "/unknown"), undefined);
  assert.equal(empireDestination("/tasks/WUFF-1"), "todo");
  assert.equal(empireDestination("/totake"), "totake");
  assert.equal(empireDestination("/totake-other"), null);
  assert.equal(empireDestination("/settings/totake"), "account");
  assert.equal(empireDestination("/"), "dashboard");
  const child = {
    ...sample(),
    id: "sample-child",
    permissions: [],
    href: "/sample/nested",
    routes: ["/sample/nested"],
    settingsHref: "/settings/sample-child",
    settings: [["/settings/sample-child", "Overview"]] as const,
    dashboard: [{ id: "sample-child.summary" }],
    mcpTools: [],
    mcpGroups: [],
  };
  assert.equal(
    moduleForPath(createModuleRegistry([added, child]), "/sample/nested/item"),
    child,
  );
});
test("registry rejects duplicate IDs/routes/widgets/groups/tools, reserved routes and incomplete contributions", () => {
  const invalid: EmpireModule[] = [
    { ...sample(), id: "Bad ID" },
    { ...sample(), href: "/elsewhere" },
    { ...sample(), routes: ["/settings"] },
    { ...sample(), href: "/api/example", routes: ["/api/example"] },
    { ...sample(), href: "//external", routes: ["//external"] },
    { ...sample(), routes: ["/sample/"] },
    { ...sample(), settings: [] },
    {
      ...sample(),
      settingsHref: "https://example.invalid",
      settings: [["https://example.invalid", "External"]],
    },
    { ...sample(), hasDashboard: false },
    { ...sample(), dashboard: [{ id: "other.summary" }] },
    {
      ...sample(),
      dashboard: [{ id: "sample.summary" }, { id: "sample.summary" }],
    },
    {
      ...sample(),
      mcpGroups: [
        { id: "sample", title: "One", order: 1 },
        { id: "sample", title: "Two", order: 2 },
      ],
    },
    { ...sample(), mcpTools: [{ ...sample().mcpTools[0], group: "missing" }] },
    { ...sample(), mcpTools: [{ ...sample().mcpTools[0], control: true }] },
    { ...sample(), mcpTools: [{ ...sample().mcpTools[0], scopes: [] }] },
    { ...sample(), mcpTools: [sample().mcpTools[0], sample().mcpTools[0]] },
  ];
  for (const module of invalid)
    assert.throws(() => createModuleRegistry([module]));
  assert.throws(() => createModuleRegistry([sample(), sample()]));
  assert.throws(() =>
    createModuleRegistry([
      ...empireModules,
      { ...sample(), routes: ["/lists"], href: "/lists" },
    ]),
  );
  assert.throws(() =>
    createModuleRegistry([
      ...empireModules,
      {
        ...sample(),
        mcpGroups: [{ id: "todo", title: "Collision", order: 1 }],
        mcpTools: [],
      },
    ]),
  );
  assert.throws(() =>
    createModuleRegistry([
      ...empireModules,
      { ...sample(), mcpTools: [{ ...sample().mcpTools[0], id: "get_task" }] },
    ]),
  );
});
test("module visibility and summaries preserve defaults and never change tool permissions or another product", () => {
  assert.deepEqual(empireAppPreference({}, "todo"), {
    visible: true,
    dashboard: true,
  });
  assert.deepEqual(empireAppPreference({}, "totake"), {
    visible: true,
    dashboard: false,
  });
  const previous = {
    todo: { visible: true, dashboard: true },
    totake: { visible: true, dashboard: true },
  };
  const next = applyEmpireChanges(previous, [
    { appId: "totake", visible: false },
  ]);
  assert.deepEqual(next.todo, previous.todo);
  assert.deepEqual(next.totake, { visible: false, dashboard: true });
  assert.deepEqual(previous.totake, { visible: true, dashboard: true });
  assert(mcpToolAllowed("get_totake", ["totake:read"], null));
  assert(!mcpToolAllowed("get_totake", ["lists:read"], null));
  assert(!mcpToolAllowed("get_totake", ["totake:read"], []));
  for (const module of empireModules)
    for (const tool of module.mcpTools)
      assert.equal(
        mcpToolCatalog.find((entry) => entry.id === tool.id),
        tool,
      );
});
test("module MCP registrars cannot inject tools outside their declared ownership or bypass unknown-tool policy", async () => {
  const server = new McpServer({ name: "synthetic-module-test", version: "1" });
  try {
    const context = createMcpContext(
      server,
      { id: "synthetic", scopes: ["totake:read"] },
      [],
    );
    const scoped = scopeModuleMcpContext(context, ["get_totake", "unknown"]);
    assert(!("server" in scoped));
    assert.throws(
      () => scoped.registerTool("get_task", {}, async () => ({ content: [] })),
      /undeclared/,
    );
    assert.throws(
      () => scoped.registerTool("unknown", {}, async () => ({ content: [] })),
      /Missing MCP tool policy/,
    );
    const tool = scoped.registerTool("get_totake", {}, async () => ({
      content: [],
    }));
    assert.equal(tool.enabled, false);
  } finally {
    await server.close();
  }
});
test("the composed module database schema generates no migration from the existing 0020 snapshot", async () => {
  const previous = JSON.parse(
    await readFile("packages/db/migrations/meta/0020_snapshot.json", "utf8"),
  );
  const current = generateDrizzleJson(schema, previous.id);
  assert.deepEqual(await generateMigration(previous, current), []);
  assert.equal(
    Object.keys(current.tables).length,
    Object.keys(previous.tables).length,
  );
});
test("client-safe module metadata bundles without loading server implementations or database drivers", async () => {
  const bundled = await build({
    stdin: {
      contents:
        'export { empireModules, empireAppCatalog, mcpToolCatalog } from "@wuff/contracts"',
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  const paths = Object.keys(bundled.metafile!.inputs);
  assert(paths.some((path) => path.includes("modules/totake/manifest")));
  assert(paths.some((path) => path.includes("modules/todo/manifest")));
  assert(
    !paths.some((path) =>
      /packages\/(domain|db)\/|node_modules\/.*\/(pg|sharp)\//.test(path),
    ),
  );
});

test("module dashboard UI bundles for browsers without server/database code", async () => {
  const bundled = await build({
    entryPoints: ["apps/web/src/modules/ui.ts"],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  const paths = Object.keys(bundled.metafile!.inputs);
  assert(paths.some((path) => path.endsWith("modules/todo/dashboard.tsx")));
  assert(paths.some((path) => path.endsWith("modules/totake/dashboard.tsx")));
  assert(!paths.some((path) => /packages\/(domain|db)\//.test(path)));
});

test("dashboard slots render their content and replace only a failed contribution with labeled recovery", async () => {
  const React = await import(require.resolve("react"));
  const { renderToStaticMarkup } = await import(
    require.resolve("react-dom/server")
  );
  const { ModuleDashboardSlot } = await import(
    new URL(
      "../apps/web/src/components/module-dashboard-slot.tsx",
      import.meta.url,
    ).href
  );
  const props = {
    name: "Synthetic app",
    children: React.createElement("p", null, "Synthetic widget content"),
  };
  const slot = new ModuleDashboardSlot(props);
  assert.match(renderToStaticMarkup(slot.render()), /Synthetic widget content/);
  slot.state = {
    ...slot.state,
    ...ModuleDashboardSlot.getDerivedStateFromError(),
  };
  const failed = renderToStaticMarkup(slot.render());
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Could not open your Synthetic app dashboard/);
  assert.match(failed, /Reload dashboard/);
  assert.doesNotMatch(failed, /Synthetic widget content/);
});

test("native module dispatch composes products without prototype fallthrough or duplicate action ownership", async () => {
  const { composeNativeOperations, nativeOperation, nativeBackgroundJobs } =
    await import("../apps/web/src/modules/native");
  const actor = { id: "synthetic-native-user", scopes: ["totake:read"] };
  const operations = composeNativeOperations([
    { read_first: (viewer, input) => ({ userId: viewer.id, input }) },
    { read_second: () => "second" },
  ]);
  assert.equal(Object.getPrototypeOf(operations), null);
  assert.deepEqual(operations.read_first(actor, { value: 1 }), {
    userId: actor.id,
    input: { value: 1 },
  });
  assert.equal(operations.read_second(actor, undefined), "second");
  assert.throws(
    () =>
      composeNativeOperations([{ duplicate: () => 1 }, { duplicate: () => 2 }]),
    /Duplicate native operation/,
  );
  for (const name of ["toString", "constructor", "__proto__", "missing_action"])
    assert.throws(() => nativeOperation(name), { code: "not_found" });
  assert.deepEqual(await nativeOperation("session")(actor, undefined), {
    userId: actor.id,
    scopes: actor.scopes,
  });
  assert.equal(typeof nativeOperation("getTotake"), "function");
  assert.equal(typeof nativeOperation("getList"), "function");
  assert.equal(nativeBackgroundJobs("getTotake").length, 0);
  assert.equal(nativeBackgroundJobs("createTask").length, 1);
  assert.equal(nativeBackgroundJobs("getList").length, 0);
});
