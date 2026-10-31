import type { ListView, TodoList } from "@wuff/contracts";

// Empty optional columns do not reserve title space; saved display settings stay intact.
export function populatedTaskColumns(list: TodoList, view: ListView) {
  const tasks = list.tasks.filter((task) => !task.parentTaskId);
  return view.columns.filter(
    (column) =>
      column === "status" ||
      tasks.some((task) =>
        column === "priority"
          ? task.priority !== "none"
          : column === "assignee"
            ? !!task.assigneeId
            : !!task.dueDate,
      ),
  );
}
export function inlineTaskRequest(
  list: TodoList,
  draft: {
    title: string;
    sectionId: string | null;
    parentTaskId?: string;
    dueDate?: string;
    priority?: string;
  },
) {
  const title = draft.title.trim();
  if (list.archived) throw Error("Restore the list before adding tasks.");
  if (!title || title.length > 300)
    throw Error("Enter a task name of 1–300 characters.");
  if (
    draft.parentTaskId &&
    !list.tasks.some(
      (task) => task.id === draft.parentTaskId && !task.parentTaskId,
    )
  )
    throw Error("This parent task is no longer available.");
  if (
    !draft.parentTaskId &&
    draft.sectionId &&
    !list.sections.some((section) => section.id === draft.sectionId)
  )
    throw Error("This section is no longer available. Choose another section.");
  return {
    listId: list.id,
    version: list.version,
    title,
    ...(draft.parentTaskId
      ? { parentTaskId: draft.parentTaskId }
      : { sectionId: draft.sectionId }),
    ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
    ...(list.mode === "work" && draft.priority
      ? { priority: draft.priority }
      : {}),
  };
}
export function captureMatchesList(value: unknown, listId: string): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    "listId" in value &&
    value.listId === listId
  );
}
