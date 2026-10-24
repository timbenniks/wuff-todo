import { useRef, useState, type CSSProperties } from "react";
import type { ListColor, Task, TodoList } from "@wuff/contracts";
import { listPalette, listThemeVariables } from "@wuff/design";
import { Button } from "@wuff/ui/button";
import { Input } from "@wuff/ui/input";
import { NativeSelect } from "@wuff/ui/native-select";
import { StatusTag } from "@wuff/ui/status-tag";
import { TaskRow } from "@wuff/ui/features/app/lists/task-row";
import { ListTheme } from "@wuff/ui/features/components/list-theme";
import { Corgi } from "@wuff/ui/features/components/corgi";
import { RuntimeContext, type FeatureRuntime } from "@wuff/ui/features/runtime";
import type { ListChange } from "@wuff/ui/features/app/lists/list-settings";
import type { NoteDraft } from "@wuff/ui/features/app/lists/task-notes";
import type { DueDateDraft } from "@wuff/ui/features/app/lists/task-due-date";

function task(title: string, position: number, id = crypto.randomUUID()): Task {
  const now = "2026-10-23T12:00:00.000Z";
  return {
    id,
    key: `WUFF-${position + 1}`,
    path: `#task-${id}`,
    title,
    content: "",
    completed: false,
    status: "todo",
    priority: "none",
    assigneeId: null,
    references: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    dueDate: null,
    parentTaskId: null,
    sectionId: null,
    position,
  };
}
const runtime: FeatureRuntime = {
  api: async () => {
    throw new Error(
      "This interaction is not simulated yet. Your example has not contacted Wuff.",
    );
  },
  request: async () =>
    new Response(
      JSON.stringify({
        error: "Example only: uploads and integrations need a local mock.",
      }),
      { status: 501 },
    ),
  navigate: (url) => {
    if (url.startsWith("#")) location.hash = url;
  },
  signOut: async () => {},
  reset: () => {},
  webOrigin: "https://wuff-todo.vercel.app",
};
export function App({ embedded = false }: { embedded?: boolean }) {
  const [list, setList] = useState<TodoList>(() => ({
    id: "11111111-1111-4111-8111-111111111111",
    mode: "work",
    assignees: [],
    title: "Ideas for our pack",
    ownerId: "example-person",
    shared: false,
    version: 1,
    color: "blue",
    description: "Synthetic examples. Refresh resets this example.",
    archived: false,
    sections: [],
    tasks: [
      task(
        "Try the real task controls",
        0,
        "22222222-2222-4222-8222-222222222222",
      ),
      task(
        "Explore a new idea together",
        1,
        "33333333-3333-4333-8333-333333333333",
      ),
    ],
  }));
  const [title, setTitle] = useState(""),
    [notice, setNotice] = useState("");
  const notes = useRef(new Map<string, NoteDraft>()),
    children = useRef(new Map<string, string>()),
    due = useRef(new Map<string, DueDateDraft>());
  const change: ListChange = async (_path, method, body) => {
    setList((current) => {
      let tasks = current.tasks;
      if (method === "PATCH")
        tasks = tasks.map((t) =>
          t.id !== body.taskId
            ? t
            : {
                ...t,
                ...Object.fromEntries(
                  Object.entries(body).filter(([key]) =>
                    [
                      "title",
                      "content",
                      "dueDate",
                      "sectionId",
                      "completed",
                    ].includes(key),
                  ),
                ),
                ...(typeof body.completed === "boolean"
                  ? {
                      completed: body.completed,
                      status: body.completed
                        ? ("done" as const)
                        : ("todo" as const),
                      completedAt: body.completed
                        ? new Date().toISOString()
                        : null,
                    }
                  : {}),
              },
        );
      if (method === "DELETE")
        tasks = tasks.filter(
          (t) => t.id !== body.taskId && t.parentTaskId !== body.taskId,
        );
      if (method === "POST")
        tasks = [
          ...tasks,
          {
            ...task(String(body.title), tasks.length),
            parentTaskId: typeof body.taskId === "string" ? body.taskId : null,
          },
        ];
      if (method === "PUT" && Array.isArray(body.taskIds))
        tasks = tasks.map((t) => ({
          ...t,
          position: (body.taskIds as string[]).includes(t.id)
            ? (body.taskIds as string[]).indexOf(t.id)
            : t.position,
        }));
      return { ...current, version: current.version + 1, tasks };
    });
    setNotice("Updated in this example only.");
    return true;
  };
  return (
    <RuntimeContext.Provider value={runtime}>
      {!embedded && <ListTheme color={list.color} />}
      <section
        aria-label="Example workspace"
        className="example"
        style={listThemeVariables(list.color) as CSSProperties}
      >
        <header className="flex items-center gap-4">
          <Corgi size={56} />
          <div>
            <p className="text-sm text-muted-foreground">
              Wuff design playground
            </p>
            <h1>{list.title}</h1>
          </div>
        </header>
        <p className="mt-4 text-muted-foreground">
          {list.description} These controls use the real Wuff source.
        </p>
        <div className="example-panel">
          <label htmlFor="palette" className="block font-semibold mb-2">
            List palette
          </label>
          <NativeSelect
            id="palette"
            value={list.color}
            onChange={(e) =>
              setList({ ...list, color: e.target.value as ListColor })
            }
          >
            {Object.entries(listPalette).map(([key, color]) => (
              <option key={key} value={key}>
                {color.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <h2>Your idea goes here</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            setList({
              ...list,
              tasks: [...list.tasks, task(title.trim(), list.tasks.length)],
            });
            setTitle("");
          }}
        >
          <label className="grow min-w-0">
            Task name
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <Button type="submit" variant="primary" className="self-end">
            Add task
          </Button>
        </form>
        <ul className="example-panel" aria-label="Example tasks">
          {list.tasks
            .filter((t) => !t.parentTaskId)
            .sort((a, b) => a.position - b.position)
            .map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                userId={list.ownerId}
                list={list}
                busy={false}
                change={change}
                drafts={notes.current}
                subtaskDrafts={children.current}
                dueDrafts={due.current}
                today={new Date().toLocaleDateString("en-CA")}
                detailed
              />
            ))}
        </ul>
        <p role="status">{notice}</p>
        <h2>Workflow states</h2>
        <div className="flex flex-wrap gap-2">
          {(
            ["todo", "in_progress", "in_review", "blocked", "done"] as const
          ).map((status) => (
            <StatusTag key={status} status={status} />
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          This component example uses synthetic data and local state. Record
          real feature behavior and checks in your PR.{" "}
          <a
            className="underline"
            href="https://wuff-todo.vercel.app/docs"
            target="_blank"
            rel="noreferrer"
          >
            Read the Wuff implementation guide
          </a>
          .
        </p>
      </section>
    </RuntimeContext.Provider>
  );
}
