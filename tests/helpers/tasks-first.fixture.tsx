// Browser component fixture: synthetic data only; no network or backend writes.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ListContext } from "../../packages/ui/src/modules/todo/app/lists/list-context";
import { ListApp } from "../../packages/ui/src/modules/todo/app/lists/list-app";
import {
  RuntimeContext,
  type FeatureRuntime,
} from "../../packages/ui/src/features/runtime";
import { type ListSummary, type TodoList, type Task } from "@wuff/contracts";

const titles = [
  "01 · Unreal foundations",
  "02 · Movement and combat",
  "03 · Art direction",
  "04 · Captain Crumb",
  "05 · Waffle Nebula",
  "06 · Polish and release",
  "07 · Tools and future ideas with a deliberately long title",
];
const parent: ListSummary = {
  id: "parent",
  title: "🚀 Cosmic Breakfast | Master plan",
  ownerId: "synthetic",
  color: "blue",
  archived: false,
  shared: false,
  version: 1,
  favorite: true,
};
if (location.search.includes("long")) {
  titles.push(
    ...Array.from(
      { length: 33 },
      (_, index) => `Extended sublist ${index + 8}`,
    ),
  );
}
const children = titles.map((title, index): ListSummary => ({
  ...parent,
  id: `child-${index}`,
  title,
  favorite: false,
  parentListId: parent.id,
  shared: index === 1,
}));
const catalog = [parent, ...children];
const task = (title: string, index: number): Task => ({
  id: `task-${index}`,
  key: `WUF-${index}`,
  path: `/tasks/task-${index}`,
  title,
  completed: false,
  parentTaskId: null,
  status: "todo",
  priority: "medium",
  assigneeId: null,
  references: [],
  createdAt: "2026-10-31T10:00:00Z",
  updatedAt: "2026-10-31T10:00:00Z",
  completedAt: null,
  dueDate: null,
  content: "Synthetic notes",
  position: index,
  sectionId: null,
});
const lists = catalog.map((summary): TodoList => ({
  ...summary,
  mode: "work",
  description: "",
  sections: [],
  assignees: [],
  tasks:
    summary.id === parent.id
      ? [
          task("Start here: project charter and definition of done", 1),
          task("Project milestones and playtest journal", 2),
        ]
      : [],
}));
if (location.search.includes("dense")) {
  lists[0].tasks = Array.from({ length: 25 }, (_, index) =>
    task(`Dense task ${index}`, index),
  );
}
const runtime: FeatureRuntime = {
  api: async <T,>(path: string, method = "GET") => {
    if (method !== "GET")
      throw Error("Synthetic fixture blocks persisted writes");
    if (path === "/api/v1/lists") return catalog as T;
    if (path === "/api/v1/invitations") return [] as T;
    const list = lists.find((item) => path === `/api/v1/lists/${item.id}`);
    if (list) return list as T;
    throw Error(`Unexpected fixture read: ${path}`);
  },
  navigate: () => {},
  signOut: async () => {},
  reset: () => {},
  webOrigin: "",
  request: async () => {
    throw Error("Network requests disabled in component fixture");
  },
};
function ComponentFixture() {
  const [items, setItems] = useState(catalog);
  const [id, setId] = useState("parent");
  useEffect(() => {
    const remove = () => setItems([]);
    window.addEventListener("fixture:remove-catalog", remove);
    return () => window.removeEventListener("fixture:remove-catalog", remove);
  }, []);
  return (
    <main
      id="list-content"
      tabIndex={-1}
      className="todo-workspace workspace-main"
    >
      <div aria-label="Fixture controls">
        <button onClick={() => setItems([])}>Remove catalog</button>
        <button onClick={() => setItems(catalog)}>Restore catalog</button>
        <button
          onClick={() =>
            setItems(
              catalog.map((item) => ({
                ...item,
                archived: item.id.startsWith("child"),
              })),
            )
          }
        >
          Archive children
        </button>
        <button onClick={() => setId(id === "parent" ? "child-0" : "parent")}>
          Switch list
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("wuff:todo:capture", {
                detail: { listId: "other" },
              }),
            )
          }
        >
          Unrelated capture
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("wuff:todo:capture", { detail: { listId: id } }),
            )
          }
        >
          Capture here
        </button>
      </div>
      <ListContext lists={items} id={id} taskCount={2} choose={setId}>
        <label>
          Task draft
          <input aria-label="Task draft" />
        </label>
      </ListContext>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  location.search.includes("component") ? (
    <ComponentFixture />
  ) : (
    <RuntimeContext.Provider value={runtime}>
      <ListApp
        userId="synthetic"
        name="Synthetic preview"
        initialLists={catalog}
        initialList={
          location.search.includes("deep") ? lists.at(-1)! : lists[0]
        }
        initialInvitations={[]}
        liveConfig={null}
      />
    </RuntimeContext.Provider>
  ),
);
