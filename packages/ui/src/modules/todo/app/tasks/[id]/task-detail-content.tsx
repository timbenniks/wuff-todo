"use client";
import { TaskReminder } from "../../../components/reminders/task-reminder";
import { useRef, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import type { Task, TodoList } from "@wuff/contracts";
import { StatusTag } from "../../../../../status-tag";
import { Button } from "../../../../../button";
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
import { formatDueDate } from "../../../lib/due-date";
import { useRuntime } from "../../../../../features/runtime";
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
  retry,
}: {
  retry?: () => Promise<boolean>;
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
  const [workEditing, setWorkEditing] = useState(false);
  const statusTrigger = useRef<HTMLButtonElement>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [githubVisited, setGithubVisited] = useState(false);
  const [agentVisited, setAgentVisited] = useState(false);
  const today = useCalendarDay();
  const body = { listId: list.id, version: list.version, taskId: task.id };
  return (
    <div className="task-detail task-detail-content">
      <div className="task-identifier flex items-center gap-0 text-xs text-muted-foreground mb-2">
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
      <div className="task-detail-title">
        <button
          className="task-complete"
          disabled={busy || list.archived}
          aria-label={task.completed ? "Reopen task" : "Complete task"}
          onClick={() =>
            change("/api/v1/tasks", "PATCH", {
              ...body,
              completed: !task.completed,
            })
          }
        >
          <span
            className={`task-checkbox ${task.completed ? "task-checkbox-done" : ""}`}
          >
            {task.completed && <Check size={13} aria-hidden="true" />}
          </span>
        </button>
        <InlineName
          value={task.title}
          label="Task name"
          editLabel="Rename task"
          heading="h1"
          completed={task.completed}
          editable={!list.archived}
          disabled={busy}
          onSave={(title) =>
            change("/api/v1/tasks", "PATCH", { ...body, title })
          }
        />
      </div>
      <dl className="task-properties">
        <div>
          <dt>Due date</dt>
          <dd>
            <Button
              variant="ghost"
              disabled={busy || list.archived}
              ref={dateTrigger}
              aria-label={task.dueDate ? "Change due date" : "Set due date"}
              aria-expanded={dateOpen}
              onClick={() => setDateOpen(!dateOpen)}
            >
              {task.dueDate ? formatDueDate(task.dueDate) : "Not set"}
            </Button>
          </dd>
        </div>
        <div>
          <dt>Reminder</dt>
          <dd>
            <Button
              variant="ghost"
              disabled={busy}
              aria-label="Remind me"
              aria-expanded={reminderOpen}
              onClick={() => setReminderOpen(!reminderOpen)}
            >
              Personal reminder
            </Button>
          </dd>
        </div>
      </dl>
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
      <div className="task-detail-panels grid gap-4">
        <WorkMetadata
          task={task}
          list={list}
          busy={busy}
          change={change}
          editing={workEditing}
          onEditingChange={setWorkEditing}
          returnFocus={statusTrigger}
        />
        <section className="task-detail-notes">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Notes</h2>
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
            <button
              className="task-empty-note"
              disabled={busy || list.archived}
              onClick={() => setNotesOpen(true)}
            >
              Add a note…
            </button>
          )}
        </section>
        <div className="task-detail-context min-w-0">
          {!task.parentTaskId && (
            <section className="task-detail-subtasks">
              <h2 className="text-sm font-semibold">Subtasks</h2>
              <p className="subtask-progress">
                {
                  list.tasks.filter(
                    (t) => t.parentTaskId === task.id && t.completed,
                  ).length
                }{" "}
                of {list.tasks.filter((t) => t.parentTaskId === task.id).length}{" "}
                done
              </p>
              <Subtasks
                retry={retry}
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
    </div>
  );
}
