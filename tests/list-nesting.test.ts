import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessibleListNesting,
  sidebarGroups,
  reorderListsSchema,
  type ListSummary,
} from "@wuff/contracts";
const entry = (
  id: string,
  parentListId: string | null = null,
  archived = false,
): ListSummary => ({
  id,
  title: id,
  parentListId,
  archived,
  ownerId: "actor",
  shared: false,
  version: 0,
  color: "blue",
});
test("sidebar projection groups independent lists and promotes children whose parent is archived", () => {
  const lists = [
    entry("child", "parent"),
    entry("other"),
    entry("parent"),
    entry("child2", "parent"),
  ];
  assert.deepEqual(
    sidebarGroups(lists, false).map((g) => [
      g.list.id,
      g.children.map((c) => c.id),
    ]),
    [
      ["other", []],
      ["parent", ["child", "child2"]],
    ],
  );
  lists[2].archived = true;
  assert.deepEqual(
    sidebarGroups(lists, false).map((g) => g.list.id),
    ["child", "other", "child2"],
  );
  assert.deepEqual(
    sidebarGroups(lists, true).map((g) => g.list.id),
    ["parent"],
  );
});
test("personal nesting filters removed access, self references, cycles and grandchildren", () => {
  const nesting = [
    { listId: "b", parentListId: "a" },
    { listId: "c", parentListId: "b" },
    { listId: "d", parentListId: "gone" },
    { listId: "e", parentListId: "e" },
  ];
  assert.deepEqual(accessibleListNesting(["a", "b", "c", "d", "e"], nesting), [
    { listId: "b", parentListId: "a" },
  ]);
  assert.deepEqual(accessibleListNesting(["b"], nesting), []);
  assert.deepEqual(
    accessibleListNesting(
      ["a", "b"],
      [
        { listId: "a", parentListId: "b" },
        { listId: "b", parentListId: "a" },
      ],
    ),
    [],
  );
});
test("older reorder payloads omit hierarchy rather than clearing it", () => {
  const value = reorderListsSchema.parse({
    version: 0,
    listIds: [],
    operationId: crypto.randomUUID(),
  });
  assert.equal(value.nesting, undefined);
  assert.equal(value.collapsedListIds, undefined);
});

test("active favorites appear only in Favorites while remaining children stay reachable", () => {
  const lists = [entry("parent"), entry("child", "parent"), entry("other")];
  lists[1].favorite = true;
  assert.deepEqual(
    sidebarGroups(lists, false).map((g) => [
      g.list.id,
      g.children.map((c) => c.id),
    ]),
    [
      ["parent", []],
      ["other", []],
    ],
  );
  lists[0].favorite = true;
  lists[1].favorite = false;
  assert.deepEqual(
    sidebarGroups(lists, false).map((g) => g.list.id),
    ["child", "other"],
  );
  assert.equal(lists[1].parentListId, "parent");
  lists[0].favorite = false;
  assert.deepEqual(
    sidebarGroups(lists, false)[0].children.map((c) => c.id),
    ["child"],
  );
  lists[0].favorite = true;
  lists[0].archived = true;
  assert.deepEqual(
    sidebarGroups(lists, true).map((g) => g.list.id),
    ["parent"],
  );
});
