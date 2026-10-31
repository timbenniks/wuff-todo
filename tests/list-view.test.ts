import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultListView,
  starterViews,
  viewSettings,
  updateListViewSchema,
  listViewSchema,
  projectListView,
  type Task,
  type TodoList,
} from "@wuff/contracts";
const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  key: `WUFF-${id}`,
  path: `/tasks/${id}`,
  title: id,
  content: "",
  completed: false,
  status: "todo",
  priority: "none",
  assigneeId: null,
  references: [],
  parentTaskId: null,
  dueDate: null,
  position: Number(id) || 0,
  sectionId: null,
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
  completedAt: null,
  ...patch,
});
const list = (tasks: Task[]): TodoList => ({
  id: "list",
  title: "Work",
  mode: "work",
  ownerId: "owner",
  shared: false,
  version: 1,
  description: "",
  archived: false,
  color: "blue",
  assignees: [],
  sections: [],
  tasks,
});
const project = (
  tasks: Task[],
  patch: Parameters<typeof listViewSchema.parse>[0],
) => projectListView(list(tasks), listViewSchema.parse(patch), "2026-10-17");
test("combined filters match each task, retain contextual parent and inherit its section", () => {
  const sectionId = crypto.randomUUID();
  const parent = task("1", { title: "Parent", sectionId });
  const child = task("2", {
    parentTaskId: "1",
    title: "Fix auth",
    status: "blocked",
    priority: "urgent",
    assigneeId: "sam",
    dueDate: "2026-10-17",
  });
  const data = list([parent, child, task("3", { status: "blocked" })]);
  data.sections = [{ id: sectionId, title: "Engineering", position: 0 }];
  const view = listViewSchema.parse({
    search: "wuff-2",
    sections: [sectionId],
    statuses: ["blocked"],
    priorities: ["urgent"],
    assignees: ["sam"],
    due: "today",
    completed: "hide",
  });
  const groups = projectListView(data, view, "2026-10-17");
  assert.deepEqual(
    groups.flatMap((g) => g.tasks.map((t) => t.id)),
    ["1"],
  );
  assert.deepEqual(groups[1].childMatches, { "1": ["2"] });
  assert.equal(
    projectListView(
      data,
      { ...view, assignees: ["elsewhere"] },
      "2026-10-17",
    ).flatMap((g) => g.tasks).length,
    0,
  );
});
test("sorting is deterministic, missing dates sort last, section overrides are scoped", () => {
  const tasks = [
    task("3"),
    task("2", { dueDate: "2026-10-18", priority: "urgent" }),
    task("1", { dueDate: "2026-10-18", updatedAt: "2026-10-18T00:00:00Z" }),
  ];
  assert.deepEqual(
    project(tasks, { sortBy: "due" })[0].tasks.map((t) => t.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    project(tasks, { sortBy: "priority" })[0].tasks.map((t) => t.id),
    ["2", "1", "3"],
  );
  assert.deepEqual(
    project(tasks, { sortBy: "updated" })[0].tasks.map((t) => t.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    project(tasks, {
      sortBy: "manual",
      sectionSorts: [{ sectionId: null, sortBy: "priority" }],
    })[0].tasks.map((t) => t.id),
    ["2", "1", "3"],
  );
  assert.deepEqual(
    project(tasks, {
      groupBy: "status",
      sortBy: "manual",
      sectionSorts: [{ sectionId: null, sortBy: "priority" }],
    })[0].tasks.map((t) => t.id),
    ["1", "2", "3"],
  );
});
test("calendar filters use the supplied local day and completion visibility is explicit", () => {
  const tasks = [
    task("1", { dueDate: "2026-10-16" }),
    task("2", { dueDate: "2026-10-17" }),
    task("3", { dueDate: "2026-10-18" }),
    task("4", { completed: true, status: "done" }),
  ];
  for (const [due, ids] of [
    ["overdue", ["1"]],
    ["today", ["2"]],
    ["upcoming", ["3"]],
    ["no_date", ["4"]],
  ] as const)
    assert.deepEqual(
      project(tasks, { due })[0].tasks.map((t) => t.id),
      ids,
    );
  assert.deepEqual(
    project(tasks, { completed: "only" })[0].tasks.map((t) => t.id),
    ["4"],
  );
  assert.deepEqual(
    project(tasks, { completed: "hide" })[0].tasks.map((t) => t.id),
    ["1", "2", "3"],
  );
  assert.equal(
    projectListView(
      list(tasks),
      { ...defaultListView(), due: "today" },
      "2026-10-18",
    )[0].tasks[0].id,
    "3",
  );
  assert.deepEqual(
    project(tasks, { groupBy: "date" }).map((g) => g.title),
    ["2026-10-16", "2026-10-17", "2026-10-18", "No due date"],
  );
});
test("view contracts reject unbounded or unknown options", () => {
  assert.equal(listViewSchema.safeParse({ sortBy: "random" }).success, false);
  assert.equal(
    listViewSchema.safeParse({ search: "a".repeat(301) }).success,
    false,
  );
  assert.equal(listViewSchema.safeParse({ ownerId: "other" }).success, false);
});

test("personal presets validate unique bounded names, selected IDs and display settings", () => {
  const id = crypto.randomUUID();
  const view = listViewSchema.parse({
    presets: [
      {
        id,
        name: "  Focus  ",
        settings: { completed: "hide", columns: ["status", "due"] },
      },
    ],
    activePresetId: id,
  });
  assert.equal(view.presets[0].name, "Focus");
  assert.deepEqual(view.presets[0].settings.columns, ["status", "due"]);
  assert.equal(viewSettings(view).rowStyle, "list");
  assert.equal(
    viewSettings(listViewSchema.parse({ ...view, rowStyle: "columns" }))
      .rowStyle,
    "columns",
  );
  assert.equal("presets" in viewSettings(view), false);
  assert.throws(() =>
    listViewSchema.parse({
      ...view,
      presets: [
        ...view.presets,
        { ...view.presets[0], id: crypto.randomUUID(), name: "focus" },
      ],
    }),
  );
  assert.throws(() =>
    listViewSchema.parse({ ...view, activePresetId: crypto.randomUUID() }),
  );
  assert.throws(() =>
    listViewSchema.parse({ ...view, columns: ["status", "status"] }),
  );
  assert.throws(() =>
    listViewSchema.parse({
      ...view,
      presets: [
        {
          ...view.presets[0],
          settings: { ...view.presets[0].settings, columns: ["due", "due"] },
        },
      ],
    }),
  );
  const old = updateListViewSchema.parse({
    listId: crypto.randomUUID(),
    viewVersion: 0,
    operationId: crypto.randomUUID(),
    view: { sortBy: "due" },
  });
  assert.equal(old.view.presets, undefined);
  assert.equal(old.view.columns, undefined);
  assert.equal(old.view.activePresetId, undefined);
  const starts = starterViews("me", true);
  assert.deepEqual(starts.find((p) => p.id === "mine")!.settings.assignees, [
    "me",
  ]);
  assert.equal(
    starterViews("me", false).some((p) => p.id === "blocked"),
    false,
  );
});
