"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, FileText, Pencil, Trash2 } from "lucide-react";
import type { Task, TodoList } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { InlineName } from "./inline-name";
import { TaskNotes, type NoteDraft } from "./task-notes";
import type { ListChange } from "./list-settings";
export function TaskRow({
  task,
  list,
  busy,
  change,
  drafts,
  dragHandle,
  rowRef,
  style,
}: {
  task: Task;
  list: TodoList;
  busy: boolean;
  change: ListChange;
  drafts: Map<string, NoteDraft>;
  dragHandle?: ReactNode;
  rowRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
}) {
  const [draftSection, setDraftSection] = useState(task.sectionId);
  const [notesOpen, setNotesOpen] = useState(drafts.has(task.id)),
    notesTrigger = useRef<HTMLButtonElement>(null);
  const disabled = busy || list.archived,
    body = { listId: list.id, version: list.version, taskId: task.id };
  return (
    <li
      ref={rowRef}
      style={style}
      className="group flex flex-wrap items-start gap-x-2 sm:gap-x-3 gap-y-2 py-3"
      data-task-id={task.id}
    >
      <button
        type="button"
        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
        disabled={disabled}
        className={`h-6 w-6 mt-1 shrink-0 rounded-full border-2 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${task.completed ? "bg-primary border-primary text-white" : "border-[#aabdcf] hover:bg-accent"}`}
        onClick={() =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            completed: !task.completed,
          })
        }
      >
        {task.completed && <Check size={15} />}
      </button>
      <InlineName
        value={task.title}
        label="Task name"
        editLabel={`Edit ${task.title}`}
        completed={task.completed}
        editable={!list.archived}
        disabled={busy}
        onSave={(title) =>
          change("/api/v1/tasks", "PATCH", {
            ...body,
            title,
            ...(list.sections.length > 0 && !task.completed
              ? { sectionId: draftSection }
              : {}),
          })
        }
        additionalDirty={draftSection !== task.sectionId}
        additionalFields={
          list.sections.length > 0 && !task.completed ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Section
              <select
                className="text-sm max-w-full"
                aria-label={`Section for ${task.title}`}
                value={draftSection ?? ""}
                disabled={disabled}
                onChange={(e) => setDraftSection(e.target.value || null)}
              >
                <option value="">No section</option>
                {list.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
        renderActions={({ edit, editing, trigger }) => (
          <div className="flex shrink-0 items-center task-actions">
            {!list.archived && (
              <Button
                ref={trigger}
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-primary"
                title="Edit task"
                aria-label={`Edit ${task.title}`}
                disabled={busy || editing}
                onClick={() => {
                  setDraftSection(task.sectionId);
                  edit();
                }}
              >
                <Pencil size={16} />
              </Button>
            )}
            <Button
              ref={notesTrigger}
              type="button"
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${notesOpen ? "bg-accent text-primary" : task.content ? "text-primary" : "text-slate-400 hover:text-primary"}`}
              title={notesOpen ? "Hide notes" : "Notes"}
              aria-label={`${notesOpen ? "Hide" : task.content ? "Edit" : "Add"} notes for ${task.title}`}
              aria-expanded={notesOpen}
              aria-controls={notesOpen ? `notes-${task.id}` : undefined}
              disabled={busy || editing || (list.archived && !task.content)}
              onClick={() => setNotesOpen((v) => !v)}
            >
              <FileText size={16} />
            </Button>
            {!list.archived && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-red-700"
                title="Delete task"
                aria-label={`Delete ${task.title}`}
                disabled={busy || editing}
                onClick={() => change("/api/v1/tasks", "DELETE", body)}
              >
                <Trash2 size={16} />
              </Button>
            )}
            {dragHandle}
          </div>
        )}
      />
      {notesOpen && (
        <div className="basis-full min-w-0 pl-8 sm:pl-9">
          <TaskNotes
            task={task}
            list={list}
            busy={busy}
            change={change}
            drafts={drafts}
            onClose={() => {
              setNotesOpen(false);
              requestAnimationFrame(() => notesTrigger.current?.focus());
            }}
          />
        </div>
      )}
    </li>
  );
}
