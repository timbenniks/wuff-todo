import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findListGroups,
  listNavigationContext,
  type ListSummary,
} from "@wuff/contracts";
import {
  clampSidebarWidth,
  readSidebarWidth,
  saveSidebarWidth,
  sidebarWidthKey,
} from "../packages/ui/src/modules/todo/lib/sidebar-width";
const entry = (
  id: string,
  title: string,
  parentListId: string | null = null,
): ListSummary => ({
  id,
  title,
  parentListId,
  archived: false,
  ownerId: "actor",
  color: "blue",
  shared: false,
  version: 1,
});
const lists = [
  entry("p", "Cosmic master plan"),
  entry("a", "Unreal foundations", "p"),
  entry("b", "Art direction", "p"),
  entry("o", "Errands"),
];
test("list search preserves parent context and saved sibling order without requiring dates or favorites", () => {
  assert.deepEqual(
    findListGroups(lists, " unreal ").map((g) => [
      g.list.id,
      g.children.map((c) => c.id),
    ]),
    [["p", ["a"]]],
  );
  assert.deepEqual(
    findListGroups(lists, "COSMIC")[0].children.map((c) => c.id),
    ["a", "b"],
  );
  assert.deepEqual(
    findListGroups(lists, "").map((g) => g.list.id),
    ["p", "o"],
  );
  assert.deepEqual(findListGroups(lists, "missing"), []);
});
test("list context shows only current accessible active parents, children and siblings", () => {
  assert.deepEqual(
    listNavigationContext(lists, "p").children.map((c) => c.id),
    ["a", "b"],
  );
  const child = listNavigationContext(lists, "a");
  assert.equal(child.parent?.id, "p");
  assert.deepEqual(
    child.siblings.map((s) => s.id),
    ["b"],
  );
  assert.deepEqual(child.children, []);
  const withoutParent = lists.filter((list) => list.id !== "p");
  assert.equal(listNavigationContext(withoutParent, "a").parent, null);
  assert.deepEqual(listNavigationContext(withoutParent, "a").siblings, []);
  assert.deepEqual(listNavigationContext(lists, "missing"), {
    parent: null,
    children: [],
    siblings: [],
  });
  assert.equal(
    listNavigationContext(
      lists.map((list) => ({ ...list, archived: list.id === "p" })),
      "a",
    ).parent,
    null,
  );
});
test("favoriting parent and child changes neither canonical context nor list-search visibility", () => {
  const favoriteLists = lists.map((list) => ({
    ...list,
    favorite: list.id === "p" || list.id === "a",
  }));
  assert.deepEqual(
    findListGroups(favoriteLists, "").map((g) => [
      g.list.id,
      g.children.map((c) => c.id),
    ]),
    [
      ["p", ["a", "b"]],
      ["o", []],
    ],
  );
  assert.equal(listNavigationContext(favoriteLists, "a").parent?.id, "p");
  assert.deepEqual(findListGroups([], ""), []);
});
test("sidebar width clamps finite and invalid input against viewport and content bounds", () => {
  assert.equal(clampSidebarWidth(100, 1280), 260);
  assert.equal(clampSidebarWidth(1000, 1280), 440);
  assert.equal(clampSidebarWidth(440, 800), 320);
  assert.equal(clampSidebarWidth(440, 768), 288);
  assert.equal(clampSidebarWidth(NaN, 1280), 260);
  assert.equal(clampSidebarWidth(Infinity, 1280), 260);
  assert.equal(clampSidebarWidth(335.7, 1280), 336);
});
test("width storage isolates accounts, resets and tolerates invalid/blocked storage", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  saveSidebarWidth(storage, "one", 400);
  assert.equal(readSidebarWidth(storage, "one"), 400);
  assert.equal(readSidebarWidth(storage, "two"), 260);
  for (const invalid of [
    "",
    " ",
    "undefined",
    "NaN",
    "Infinity",
    "999",
    "-1",
    "259",
    "null",
  ]) {
    storage.setItem(sidebarWidthKey("one"), invalid);
    assert.equal(readSidebarWidth(storage, "one"), 260, invalid);
  }
  saveSidebarWidth(storage, "one", 350);
  saveSidebarWidth(storage, "one", null);
  assert.equal(readSidebarWidth(storage, "one"), 260);
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("quota");
    },
    removeItem() {
      throw Error("blocked");
    },
  };
  assert.equal(readSidebarWidth(blocked, "one"), 260);
  assert.doesNotThrow(() => saveSidebarWidth(blocked, "one", 400));
  assert.doesNotThrow(() => saveSidebarWidth(blocked, "one", null));
});

test("MCP list edits retain fresh authorized navigation instead of dropping it or reviving stale parents", async () => {
  const { todoNavigationResponse } =
    await import("../apps/web/src/modules/todo/navigation-response");
  const edited = { id: "a", version: 8, title: "Edited child" };
  const accessible = lists.filter((list) => list.id !== "p");
  const response = await todoNavigationResponse(
    { list: edited, lists },
    true,
    async () => accessible,
  );
  assert.deepEqual(response.list, edited);
  assert.deepEqual(response.lists, accessible);
  assert.equal(
    listNavigationContext(response.lists as ListSummary[], "a").parent,
    null,
  );
  const home = await todoNavigationResponse(
    { dashboard: { today: "2026-10-31" } },
    true,
    async () => lists,
  );
  assert.deepEqual(home.lists, lists);
});
test("MCP catalog enrichment respects read scope, non-list results and read failure after a mutation", async () => {
  const { todoNavigationResponse } =
    await import("../apps/web/src/modules/todo/navigation-response");
  const unreadable = async () => {
    throw Error("Reader must not run");
  };
  assert.deepEqual(
    await todoNavigationResponse({ list: { id: "a" } }, false, unreadable),
    { list: { id: "a" } },
  );
  assert.deepEqual(
    await todoNavigationResponse({ sharing: { version: 8 } }, true, unreadable),
    { sharing: { version: 8 } },
  );
  await assert.rejects(
    todoNavigationResponse(
      { list: { id: "a", version: 8 } },
      true,
      async () => {
        throw Error("Catalog temporarily unavailable");
      },
    ),
    /Catalog temporarily unavailable/,
  );
  assert.deepEqual(
    (await todoNavigationResponse({ list: { id: "a" } }, true, async () => []))
      .lists,
    [],
  );
});
