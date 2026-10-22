"use client";
import {
  FileText,
  Flag,
  GitPullRequest,
  Link2,
  ListTree,
  UserRound,
  AlertCircle,
} from "lucide-react";
import type { Task, TodoList } from "@wuff/contracts";
import { taskMetadata } from "@/lib/task-metadata";
import { DueDateBadge } from "./task-due-date";

export function TaskMetadata({
  task,
  list,
  today,
  comfortable,
  onNotes,
  onSubtasks,
  onDetails,
}: {
  task: Task;
  list: TodoList;
  today: string | null;
  comfortable: boolean;
  onNotes: () => void;
  onSubtasks: () => void;
  onDetails?: () => void;
}) {
  const { visible, hidden } = taskMetadata(task, list, today, comfortable);
  if (!visible.length) return null;
  const icons = {
    notes: FileText,
    priority: Flag,
    github: GitPullRequest,
    references: Link2,
    progress: ListTree,
    assignee: UserRound,
    attention: AlertCircle,
  };
  return (
    <div className="task-summary" aria-label={`Details for ${task.title}`}>
      {visible.map((cue) => {
        if (cue.kind === "due")
          return <DueDateBadge key={cue.kind} task={task} today={today} />;
        const Icon = icons[cue.kind as keyof typeof icons];
        const content = (
          <>
            {Icon && <Icon size={13} aria-hidden="true" />}
            <span>{cue.label}</span>
          </>
        );
        const className = `task-cue ${cue.urgent ? "task-cue-attention" : ""}`;
        if (cue.kind === "github")
          return (
            <a
              key={cue.kind}
              className={className}
              href={task.github!.url!}
              target="_blank"
              rel="noreferrer"
            >
              {content}
            </a>
          );
        if (cue.kind === "notes" || cue.kind === "progress")
          return (
            <button
              key={cue.kind}
              type="button"
              className={className}
              aria-label={`${cue.kind === "notes" ? "Read notes" : `Subtasks: ${cue.label}`} for ${task.title}`}
              onClick={cue.kind === "notes" ? onNotes : onSubtasks}
            >
              {content}
            </button>
          );
        if (cue.kind === "attention")
          return (
            <a
              key={cue.kind}
              className={className}
              href={`${task.path}#github`}
              aria-label={`GitHub sync: ${cue.label}. Open sync controls for ${task.title}`}
              onClick={(event) => {
                if (
                  onDetails &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  onDetails();
                }
              }}
            >
              {content}
            </a>
          );
        return (
          <span key={cue.kind} className={className}>
            {content}
          </span>
        );
      })}
      {!!hidden.length && (
        <a
          className="task-cue task-cue-overflow"
          href={task.path}
          aria-label={`${hidden.length} more details for ${task.title}`}
          title={hidden.map((cue) => cue.label).join(" · ")}
          onClick={(event) => {
            if (
              onDetails &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0
            ) {
              event.preventDefault();
              onDetails();
            }
          }}
        >
          +{hidden.length} more
        </a>
      )}
    </div>
  );
}
