import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listColors,
  defaultListView,
  type TodoList,
  type Task,
} from "@wuff/contracts";
import { todoThemeVariables } from "../packages/design/src/index";
import {
  inlineTaskRequest,
  populatedTaskColumns,
  captureMatchesList,
} from "../packages/ui/src/modules/todo/lib/task-presentation";
const task = (id: string, extra: Partial<Task> = {}) =>
  ({
    id,
    title: id,
    parentTaskId: null,
    priority: "none",
    assigneeId: null,
    dueDate: null,
    ...extra,
  }) as Task;
const list = (extra: Partial<TodoList> = {}) =>
  ({
    id: "list-a",
    version: 4,
    archived: false,
    mode: "work",
    sections: [{ id: "section-a", title: "At home" }],
    tasks: [task("parent")],
    ...extra,
  }) as TodoList;
const luminance = (hex: string) => {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
test("Todo neutral light/dark text, metadata, links and primary actions retain contrast in every palette", () => {
  for (const color of listColors)
    for (const dark of [false, true]) {
      const theme = todoThemeVariables(color, dark);
      for (const background of [
        "--wuff-background",
        "--wuff-surface",
        "--wuff-sidebar",
        "--wuff-accent",
      ] as const)
        for (const foreground of [
          "--wuff-foreground",
          "--wuff-muted",
          "--wuff-primary",
        ] as const)
          assert(
            contrast(theme[foreground], theme[background]) >= 4.5,
            `${color}/${dark}/${foreground}/${background}`,
          );
      assert(contrast("#ffffff", theme["--wuff-action"]) >= 4.5);
    }
});
test("empty optional columns release title space without changing saved view configuration", () => {
  const view = {
    ...defaultListView(),
    columns: ["status", "priority", "assignee", "due"] as const,
  };
  const draft = { ...view, columns: [...view.columns] };
  assert.deepEqual(populatedTaskColumns(list(), draft), ["status"]);
  assert.deepEqual(
    populatedTaskColumns(
      list({
        tasks: [
          task("a", { dueDate: "2026-10-31" }),
          task("b", { priority: "high" }),
          task("c", { assigneeId: "person" }),
        ],
      }),
      draft,
    ),
    ["status", "priority", "assignee", "due"],
  );
  assert.deepEqual(
    populatedTaskColumns(
      list({
        tasks: [task("child", { parentTaskId: "parent", priority: "high" })],
      }),
      draft,
    ),
    ["status"],
  );
  assert.deepEqual(draft.columns, ["status", "priority", "assignee", "due"]);
});
test("inline capture preserves list/section scope, metadata, current version and inherited subtask sections", () => {
  assert.deepEqual(
    inlineTaskRequest(list(), {
      title: "  Buy coffee  ",
      sectionId: "section-a",
      dueDate: "2026-11-01",
      priority: "high",
    }),
    {
      listId: "list-a",
      version: 4,
      title: "Buy coffee",
      sectionId: "section-a",
      dueDate: "2026-11-01",
      priority: "high",
    },
  );
  assert.deepEqual(
    inlineTaskRequest(list(), {
      title: "Bring bags",
      sectionId: "wrong",
      parentTaskId: "parent",
    }),
    {
      listId: "list-a",
      version: 4,
      title: "Bring bags",
      parentTaskId: "parent",
    },
  );
  assert(
    !(
      "priority" in
      inlineTaskRequest(list({ mode: "simple" }), {
        title: "Simple",
        sectionId: null,
        priority: "high",
      })
    ),
  );
});
test("inline capture rejects blank, oversize, archived and removed destinations before a request", () => {
  for (const title of [" ", "x".repeat(301)])
    assert.throws(() => inlineTaskRequest(list(), { title, sectionId: null }));
  assert.throws(
    () =>
      inlineTaskRequest(list({ archived: true }), {
        title: "Task",
        sectionId: null,
      }),
    /Restore/,
  );
  assert.throws(
    () => inlineTaskRequest(list(), { title: "Task", sectionId: "missing" }),
    /section/,
  );
  assert.throws(
    () =>
      inlineTaskRequest(list(), {
        title: "Task",
        sectionId: null,
        parentTaskId: "missing",
      }),
    /parent/,
  );
  assert.throws(
    () =>
      inlineTaskRequest(
        list({ tasks: [task("child", { parentTaskId: "parent" })] }),
        { title: "Task", sectionId: null, parentTaskId: "child" },
      ),
    /parent/,
  );
});
test("global capture events cannot open a composer for another list", () => {
  assert(captureMatchesList({ listId: "list-a" }, "list-a"));
  for (const value of [null, undefined, "list-a", { listId: "list-b" }, {}])
    assert.equal(captureMatchesList(value, "list-a"), false);
});
