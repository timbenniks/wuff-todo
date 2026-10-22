import assert from "node:assert/strict";
import test from "node:test";
import type { Task, TodoList } from "@wuff/contracts";
import { taskMetadata } from "../apps/web/src/lib/task-metadata";

const task: Task = {
  id: "task",
  key: "TEST-1",
  path: "/tasks/task",
  title: "A task",
  content: "",
  parentTaskId: null,
  sectionId: null,
  status: "todo",
  priority: "none",
  assigneeId: null,
  references: [],
  createdAt: "2026-10-22",
  updatedAt: "2026-10-22",
  completedAt: null,
  dueDate: null,
  completed: false,
  position: 0,
};
const list: TodoList = {
  id: "list",
  mode: "simple",
  title: "A list",
  ownerId: "user",
  shared: false,
  version: 1,
  color: "blue",
  description: "",
  archived: false,
  sections: [],
  assignees: [],
  tasks: [task],
};
const github = {
  issueNumber: 6,
  url: "https://example.invalid/issues/6",
  state: "synced" as const,
  active: true,
};

test("plain and default metadata stay quiet; healthy sync only shows the resource", () => {
  assert.deepEqual(taskMetadata(task, list, "2026-10-22", true), {
    visible: [],
    hidden: [],
  });
  const linked = { ...task, content: "Notes", github };
  assert.deepEqual(taskMetadata(linked, list, "2026-10-22", false), {
    visible: [],
    hidden: [],
  });
  assert.deepEqual(
    taskMetadata(
      linked,
      { ...list, mode: "work" },
      "2026-10-22",
      true,
    ).visible.map((cue) => cue.label),
    ["TEST-1", "GitHub #6", "Notes"],
  );
});

test("attention precedes future dates and metadata has a three-cue budget with accessible overflow", () => {
  const rich: Task = {
    ...task,
    content: "Notes",
    dueDate: "2026-10-30",
    status: "blocked",
    priority: "high",
    github: { ...github, state: "conflict" },
    references: [{ url: "https://example.invalid" }],
  };
  const work: TodoList = {
    ...list,
    mode: "work",
    tasks: [
      rich,
      { ...task, id: "child", parentTaskId: rich.id, completed: true },
    ],
  };
  const result = taskMetadata(rich, work, "2026-10-22", true);
  assert.deepEqual(
    result.visible.map((cue) => cue.kind),
    ["attention", "status", "due"],
  );
  assert.equal(result.visible.length, 3);
  assert(
    result.hidden.some((cue) => cue.kind === "progress" && cue.label === "1/1"),
  );
  assert(result.hidden.some((cue) => cue.kind === "notes"));
  assert(result.hidden.some((cue) => cue.kind === "references"));
});

test("compact retains urgent dates and disconnected/blocked states without supporting metadata", () => {
  const urgent: Task = {
    ...task,
    dueDate: "2026-10-20",
    status: "blocked",
    content: "Notes",
    github: { ...github, active: false },
  };
  const result = taskMetadata(
    urgent,
    { ...list, mode: "work" },
    "2026-10-22",
    false,
  );
  assert.deepEqual(
    result.visible.map((cue) => cue.kind),
    ["due", "attention", "status"],
  );
  assert(result.visible.every((cue) => cue.urgent));
  assert.deepEqual(result.hidden, []);
  assert.equal(
    taskMetadata(
      { ...task, dueDate: "2026-10-20", completed: true },
      list,
      "2026-10-22",
      false,
    ).visible.length,
    0,
  );
});

test("pending sync stays neutral and does not masquerade as urgent in compact mode", () => {
  const pending: Task = { ...task, github: { ...github, state: "pending" } };
  assert.equal(
    taskMetadata(pending, list, "2026-10-22", false).visible.length,
    0,
  );
  assert.equal(
    taskMetadata(pending, list, "2026-10-22", true).visible[0].urgent,
    undefined,
  );
});
