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
test("Todo light/dark text, metadata, links and primary actions retain contrast in every palette", () => {
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

test("appearance choice defaults to light, overrides the OS and retains all list palettes", async () => {
  const { parseTodoAppearance, isTodoDark } =
    await import("../packages/ui/src/modules/todo/lib/appearance");
  const { listThemeVariables, listPalette } =
    await import("../packages/design/src/index");
  for (const input of [null, undefined, "invalid", "light"])
    assert.equal(parseTodoAppearance(input), "light");
  assert.equal(isTodoDark("light", true), false);
  assert.equal(isTodoDark("dark", false), true);
  assert.equal(isTodoDark("system", true), true);
  assert.equal(isTodoDark("system", false), false);
  for (const color of listColors)
    assert.deepEqual(todoThemeVariables(color, false), {
      ...listThemeVariables(color),
      "--wuff-action": listPalette[color].accent,
    });
  assert.notEqual(
    todoThemeVariables("rose", true)["--wuff-background"],
    todoThemeVariables("sage", true)["--wuff-background"],
  );
});
test("appearance persists locally and remains usable when browser storage is blocked", async () => {
  const {
    readTodoAppearance,
    setTodoAppearance,
    todoAppearanceKey,
    todoAppearanceEvent,
  } = await import("../packages/ui/src/modules/todo/lib/appearance");
  const descriptors = ["localStorage", "window"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const values = new Map<string, string>(),
    events: string[] = [];
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        dispatchEvent: (event: Event) => {
          events.push(event.type);
          return true;
        },
      },
    });
    assert.equal(readTodoAppearance(), "light");
    setTodoAppearance("dark");
    assert.equal(values.get(todoAppearanceKey), "dark");
    assert.equal(readTodoAppearance(), "dark");
    assert.deepEqual(events, [todoAppearanceEvent]);
    values.set(todoAppearanceKey, "system");
    assert.equal(readTodoAppearance(), "system");
    let externalChoice = "system";
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => externalChoice,
        setItem: () => {
          throw Error("quota exceeded");
        },
      },
    });
    setTodoAppearance("dark");
    assert.equal(
      readTodoAppearance(),
      "dark",
      "a readable but unwritable store must retain the current document choice",
    );
    externalChoice = "light";
    assert.equal(
      readTodoAppearance({ type: "storage", key: "unrelated" }),
      "dark",
    );
    assert.equal(
      readTodoAppearance({ type: "storage", key: todoAppearanceKey }),
      "light",
      "another tab's relevant storage event resumes persisted reads",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw Error("blocked");
      },
    });
    assert.doesNotThrow(() => setTodoAppearance("light"));
    assert.equal(readTodoAppearance(), "light");
    setTodoAppearance("dark");
    assert.equal(readTodoAppearance(), "dark");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    setTodoAppearance("light");
    assert.equal(values.get(todoAppearanceKey), "light");
    values.set(todoAppearanceKey, "system");
    assert.equal(
      readTodoAppearance(),
      "system",
      "a recovered store resumes reading persisted choices",
    );
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
test("Todo day controls preserve hidden favorite preferences and cannot move outside their visible bounds", async () => {
  const { todoDayPanels, moveTodoDayPanel, resetTodoDayPanels } =
    await import("../packages/ui/src/modules/todo/lib/dashboard-panels");
  const sections = ["today", "favorites", "upcoming"] as (
    "today" | "favorites" | "upcoming"
  )[];
  assert.deepEqual(todoDayPanels(sections), ["today", "upcoming"]);
  assert.deepEqual(moveTodoDayPanel(sections, "today", 1), [
    "upcoming",
    "favorites",
    "today",
  ]);
  for (const [id, delta] of [
    ["today", -1],
    ["upcoming", 1],
    ["favorites", 1],
  ] as const)
    assert.deepEqual(moveTodoDayPanel(sections, id, delta), sections);
  const settings = {
    sections: ["upcoming", "favorites", "today"] as typeof sections,
    hidden: ["favorites", "today"] as typeof sections,
    startPage: "last_list" as const,
  };
  assert.deepEqual(resetTodoDayPanels(settings), {
    sections,
    hidden: ["favorites"],
    startPage: "home",
  });
  assert.deepEqual(settings.hidden, ["favorites", "today"]);
});

test("leaving Todo restores the shared shell and native controls without its dark-mode state", async () => {
  const { resetListTheme, listThemeVariables } =
    await import("../packages/design/src/index");
  const values = new Map(Object.entries(todoThemeVariables("rose", true)));
  const target = {
    style: {
      colorScheme: "dark",
      setProperty: (key: string, value: string) => {
        values.set(key, value);
      },
      removeProperty: (key: string) => {
        values.delete(key);
      },
    },
    dataset: {
      listTheme: "rose",
      todoAppearance: "dark",
      otherModule: "retained",
    } as Record<string, string | undefined>,
  };
  resetListTheme(target);
  assert.equal(target.style.colorScheme, "light");
  assert.equal(target.dataset.todoAppearance, undefined);
  assert.equal(values.has("--wuff-action"), false);
  assert.deepEqual(Object.fromEntries(values), listThemeVariables("blue"));
  assert.equal(target.dataset.otherModule, "retained");
  assert.equal(target.dataset.listTheme, "blue");
});
