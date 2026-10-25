import { githubSyncLabel, type Task, type TodoList } from "@wuff/contracts";
import { dueDatePresentation } from "./due-date";

export type TaskCue = {
  kind:
    | "due"
    | "attention"
    | "status"
    | "key"
    | "progress"
    | "priority"
    | "assignee"
    | "github"
    | "notes"
    | "references";
  label: string;
  urgent?: boolean;
};

// Keep the information budget independent of the renderer and the task model.
export function taskMetadata(
  task: Task,
  list: TodoList,
  today: string | null,
  comfortable: boolean,
) {
  const cues: TaskCue[] = [];
  const date = task.dueDate
    ? dueDatePresentation(task.dueDate, task.completed, today)
    : null;
  const urgentDate = date?.tone === "today" || date?.tone === "overdue";
  if (date && urgentDate)
    cues.push({ kind: "due", label: date.label, urgent: true });
  const sync = task.github ? githubSyncLabel(task.github) : null;
  if (sync === "Needs attention" || sync === "Disconnected")
    cues.push({ kind: "attention", label: sync, urgent: true });
  if (list.mode === "work" && task.status === "blocked")
    cues.push({ kind: "status", label: "Blocked", urgent: true });
  if (comfortable) {
    if (date && !urgentDate) cues.push({ kind: "due", label: date.label });
    if (list.mode === "work") {
      if (!["todo", "done", "blocked"].includes(task.status))
        cues.push({
          kind: "status",
          label: task.status === "in_review" ? "In review" : "In progress",
        });
      if (task.priority !== "none")
        cues.push({
          kind: "priority",
          label: `${task.priority[0].toUpperCase() + task.priority.slice(1)} priority`,
        });
      cues.push({ kind: "key", label: task.key });
    }
    const children = list.tasks.filter(
      (child) => child.parentTaskId === task.id,
    );
    if (children.length)
      cues.push({
        kind: "progress",
        label: `${children.filter((child) => child.completed).length}/${children.length}`,
      });
    const assignee = list.assignees.find(
      (person) => person.id === task.assigneeId,
    );
    if (assignee) cues.push({ kind: "assignee", label: assignee.name });
    if (sync === "Pending")
      cues.push({ kind: "attention", label: "Sync pending" });
    if (task.github?.url)
      cues.push({
        kind: "github",
        label: `GitHub #${task.github.issueNumber}`,
      });
    if (task.content) cues.push({ kind: "notes", label: "Notes" });
    if (task.references.length)
      cues.push({
        kind: "references",
        label: `${task.references.length} ${task.references.length === 1 ? "link" : "links"}`,
      });
  }
  return { visible: cues.slice(0, 3), hidden: cues.slice(3) };
}
