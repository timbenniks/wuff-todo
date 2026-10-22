"use client";
import { TaskReminder } from "../../../components/reminders/task-reminder";
import { useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import type { Task, TodoList } from "@wuff/contracts";
import { StatusTag } from "../../../../status-tag";
import { Button } from "../../../../button";
import { TaskMarkdown } from "../../../components/task-markdown";
import { useCalendarDay } from "../../../lib/use-calendar-day";
import { InlineName } from "../../lists/inline-name";
import { TaskNotes, type NoteDraft } from "../../lists/task-notes";
import {
  TaskDueDate,
  DueDateBadge,
  type DueDateDraft,
} from "../../lists/task-due-date";
import { Subtasks } from "../../lists/task-row";
import type { ListChange } from "../../lists/list-settings";
import { GithubTask } from "./github-task";
import { AgentTask } from "./agent-task";
import { WorkMetadata } from "./work-metadata";

// Both the direct task URL and the list drawer use these editors. In the drawer,
// the list owns mutations, versions and live refresh; no second task cache exists.
import { useRuntime } from "../../../runtime";
export function TaskDetailContent({
  task,
  list,
  userId,
  busy,
  change,
  refresh,
  onNotice,
  onError,
  onOpenTask,
}: {
  task: Task;
  list: TodoList;
  userId: string;
  busy: boolean;
  change: ListChange;
  refresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onOpenTask?: (id: string) => void;
}) {
  const runtime = useRuntime();
  const [notesOpen, setNotesOpen] = useState(false),
    [dateOpen, setDateOpen] = useState(false);
  const noteTrigger = useRef<HTMLButtonElement>(null),
    dateTrigger = useRef<HTMLButtonElement>(null);
  const notes = useRef(new Map<string, NoteDraft>()),
    dates = useRef(new Map<string, DueDateDraft>()),
    children = useRef(new Map<string, string>());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [githubVisited, setGithubVisited] = useState(false);
  const [agentVisited, setAgentVisited] = useState(false);
  const today = useCalendarDay();
  const body = { listId: list.id, version: list.version, taskId: task.id };
  return (
    <div className="task-detail task-detail-content">
      <div className="flex items-center gap-0 text-xs text-muted-foreground mb-2">
        <span className="font-semibold tracking-wide">{task.key}</span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copy task link"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                runtime.webOrigin + task.path,
              );
              onNotice("Task link copied.");
            } catch {
              onError("Couldn’t copy. Copy this page’s address instead.");
            }
          }}
        >
          <Copy size={14} />
        </Button>
        {list.archived && <span>Archived · Read only</span>}
      </div>
      <InlineName
        value={task.title}
        label="Task name"
        editLabel="Rename task"
        heading="h1"
        completed={task.completed}
        editable={!list.archived}
        disabled={busy}
        onSave={(title) => change("/api/v1/tasks", "PATCH", { ...body, title })}
      />
      <div className="flex flex-wrap gap-2 items-center mt-3">
        {list.mode === "work" && <StatusTag status={task.status} />}
        <DueDateBadge task={task} today={today} />
      </div>
      <div className="flex flex-wrap gap-2 items-center mt-4 mb-6">
        <Button
          disabled={busy || list.archived}
          variant="primary"
          onClick={() =>
            change("/api/v1/tasks", "PATCH", {
              ...body,
              completed: !task.completed,
            })
          }
        >
          <Check size={16} />
          {task.completed ? "Reopen task" : "Complete task"}
        </Button>
        <Button
          variant="outline"
          disabled={busy || list.archived}
          onClick={() => setDateOpen(!dateOpen)}
          ref={dateTrigger}
          aria-expanded={dateOpen}
        >
          {task.dueDate ? "Change due date" : "Set due date"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          aria-expanded={reminderOpen}
          onClick={() => setReminderOpen(!reminderOpen)}
        >
          Remind me
        </Button>
      </div>
      {reminderOpen && (
        <div className="mb-6">
          <TaskReminder
            key={`${task.id}:${task.completed}`}
            listId={list.id}
            taskId={task.id}
            userId={userId}
            inactive={task.completed || list.archived}
          />
        </div>
      )}
      {dateOpen && (
        <div className="mb-6">
          <TaskDueDate
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={dates.current}
            onClose={() => {
              setDateOpen(false);
              requestAnimationFrame(() => dateTrigger.current?.focus());
            }}
          />
        </div>
      )}
      <div className="grid gap-4">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Notes</h2>
            {!notesOpen && !list.archived && (
              <Button
                variant="ghost"
                aria-label="Edit task notes"
                ref={noteTrigger}
                disabled={busy}
                onClick={() => setNotesOpen(true)}
              >
                <Pencil size={16} aria-hidden="true" /> Edit notes
              </Button>
            )}
          </div>
          {notesOpen ? (
            <TaskNotes
              task={task}
              list={list}
              busy={busy}
              change={change}
              drafts={notes.current}
              userId={userId}
              onClose={() => {
                setNotesOpen(false);
                requestAnimationFrame(() => noteTrigger.current?.focus());
              }}
            />
          ) : task.content ? (
            <TaskMarkdown content={task.content} />
          ) : (
            <p className="text-sm text-muted-foreground">
              A little context for your next step.
            </p>
          )}
        </section>
        <WorkMetadata task={task} list={list} busy={busy} change={change} />
        {!task.parentTaskId && (
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 min-w-0">
            <h2 className="text-lg font-bold mb-4">Subtasks</h2>
            <Subtasks
              focusNewTask={false}
              detailed
              onOpenTask={onOpenTask}
              parent={task}
              items={list.tasks.filter((t) => t.parentTaskId === task.id)}
              list={list}
              userId={userId}
              busy={busy}
              change={change}
              drafts={notes.current}
              subtaskDrafts={children.current}
              dueDrafts={dates.current}
              today={today}
            />
          </section>
        )}
        {list.mode === "work" && (
          <>
            <details
              className="task-integration"
              onToggle={(event) => {
                if (event.currentTarget.open) setGithubVisited(true);
              }}
            >
              <summary>
                GitHub
                {task.github?.issueNumber
                  ? ` · #${task.github.issueNumber}`
                  : ""}
              </summary>
              {githubVisited && (
                <GithubTask
                  task={task}
                  list={list}
                  userId={userId}
                  refresh={refresh}
                />
              )}
            </details>
            <details
              className="task-integration"
              onToggle={(event) => {
                if (event.currentTarget.open) setAgentVisited(true);
              }}
            >
              <summary>Coding companion</summary>
              {agentVisited && (
                <AgentTask
                  task={task}
                  list={list}
                  userId={userId}
                  refresh={refresh}
                />
              )}
            </details>
          </>
        )}
        {task.parentTaskId && (
          <a
            href={`${runtime.webOrigin}/tasks/${task.parentTaskId}`}
            onClick={(event) => {
              if (
                onOpenTask &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey &&
                event.button === 0
              ) {
                event.preventDefault();
                onOpenTask(task.parentTaskId!);
              }
            }}
            className="text-sm text-primary underline"
          >
            Open parent task
          </a>
        )}
      </div>
    </div>
  );
}
