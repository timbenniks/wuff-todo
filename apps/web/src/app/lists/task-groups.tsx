"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import type { Task, TodoList } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
import { InlineName } from "./inline-name";

export function TaskGroups({
  list,
  userId,
  busy,
  change,
}: {
  list: TodoList;
  userId: string;
  busy: boolean;
  change: ListChange;
}) {
  const [addingSection, setAddingSection] = useState(false);
  const owner = list.ownerId === userId,
    disabled = busy || list.archived;
  const body = { listId: list.id, version: list.version };
  const path = `/api/v1/lists/${list.id}/sections`;
  const active = list.tasks.filter((t) => !t.completed);
  async function moveTask(task: Task, dir: number) {
    const siblings = active.filter((t) => t.sectionId === task.sectionId),
      i = siblings.findIndex((t) => t.id === task.id),
      target = siblings[i + dir];
    if (!target) return;
    const ids = active.map((t) => t.id),
      a = ids.indexOf(task.id),
      b = ids.indexOf(target.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await change("/api/v1/tasks", "PUT", { ...body, taskIds: ids });
  }
  function rows(sectionId: string | null) {
    const items = active.filter((t) => t.sectionId === sectionId);
    return (
      <ul
        aria-label={
          sectionId
            ? `Tasks in ${list.sections.find((s) => s.id === sectionId)?.title}`
            : "Active tasks"
        }
        className="divide-y divide-border"
      >
        {items.map((task, i) => (
          <li
            key={task.id}
            className="group flex flex-wrap items-center gap-3 py-3"
          >
            <button
              aria-label={`Complete ${task.title}`}
              disabled={disabled}
              className="h-6 w-6 shrink-0 rounded-full border-2 border-[#aabdcf] hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
              onClick={() =>
                change("/api/v1/tasks", "PATCH", {
                  ...body,
                  taskId: task.id,
                  completed: true,
                })
              }
            />
            <InlineName
              value={task.title}
              label="Task name"
              editLabel={`Edit ${task.title}`}
              editable={!list.archived}
              disabled={busy}
              onSave={(title) =>
                change("/api/v1/tasks", "PATCH", {
                  ...body,
                  taskId: task.id,
                  title,
                })
              }
            />
            <div className="flex items-center">
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Move ${task.title} up`}
                disabled={disabled || i === 0}
                onClick={() => moveTask(task, -1)}
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Move ${task.title} down`}
                disabled={disabled || i === items.length - 1}
                onClick={() => moveTask(task, 1)}
              >
                <ArrowDown size={15} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${task.title}`}
                disabled={disabled}
                onClick={() =>
                  change("/api/v1/tasks", "DELETE", {
                    ...body,
                    taskId: task.id,
                  })
                }
              >
                <Trash2 size={15} />
              </Button>
            </div>
            {list.sections.length > 0 && (
              <select
                className="ml-9 w-[calc(100%-2.25rem)] sm:ml-0 sm:w-auto text-xs max-w-full"
                aria-label={`Section for ${task.title}`}
                value={task.sectionId ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  change("/api/v1/tasks", "PATCH", {
                    ...body,
                    taskId: task.id,
                    sectionId: e.target.value || null,
                  })
                }
              >
                <option value="">No section</option>
                {list.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    );
  }
  function addTask(sectionId: string | null) {
    return (
      !list.archived && (
        <form
          className="flex gap-2 mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (
              await change("/api/v1/tasks", "POST", {
                ...body,
                sectionId,
                title: String(new FormData(form).get("title")),
              })
            )
              form.reset();
          }}
        >
          <input
            name="title"
            aria-label={
              sectionId
                ? `New task in ${list.sections.find((s) => s.id === sectionId)?.title}`
                : "New task"
            }
            placeholder="Add a little thing to do…"
            maxLength={300}
            required
            className="flex-1"
          />
          <Button
            disabled={disabled}
            type="submit"
            aria-label={
              sectionId
                ? `Add task to ${list.sections.find((s) => s.id === sectionId)?.title}`
                : "Add task"
            }
          >
            <Plus size={20} />
          </Button>
        </form>
      )
    );
  }
  async function moveSection(id: string, dir: number) {
    const ids = list.sections.map((s) => s.id),
      i = ids.indexOf(id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    await change(path, "PUT", { ...body, sectionIds: ids });
  }
  return (
    <>
      {list.archived && (
        <p
          role="status"
          className="rounded-xl border border-border bg-white p-4 text-sm mb-6"
        >
          This list is archived.{" "}
          {owner
            ? "Restore it in List settings to make changes."
            : "Its owner can restore it so you can make changes again."}
        </p>
      )}
      <p className="text-sm text-slate-500 mb-5">
        {active.length} things to do
      </p>
      {list.sections.length > 0 && (
        <h2 className="text-lg font-bold mb-1">No section</h2>
      )}
      {rows(null)}
      {addTask(null)}
      {list.sections.map((section, i) => (
        <section key={section.id} className="mt-8 border-t border-border pt-4">
          <InlineName
            value={section.title}
            heading="h2"
            label="Section name"
            editLabel={`Rename section ${section.title}`}
            editable={owner && !list.archived}
            disabled={busy}
            onSave={(title) =>
              change(path, "PATCH", { ...body, sectionId: section.id, title })
            }
          />
          <div className="mt-1">
            <details open className="min-w-0 flex-1 group/section">
              <summary className="text-xs font-medium text-slate-500 py-2">
                Tasks ({active.filter((t) => t.sectionId === section.id).length}
                )
              </summary>
              <div className="mt-1">
                {rows(section.id)}
                {addTask(section.id)}
              </div>
            </details>
          </div>
          {owner && !list.archived && (
            <div className="flex justify-end gap-1 mt-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={busy || i === 0}
                aria-label={`Move section ${section.title} up`}
                onClick={() => moveSection(section.id, -1)}
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy || i === list.sections.length - 1}
                aria-label={`Move section ${section.title} down`}
                onClick={() => moveSection(section.id, 1)}
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`Remove section ${section.title}`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove section “${section.title}”? Its tasks will be kept under No section.`,
                    )
                  )
                    void change(path, "DELETE", {
                      ...body,
                      sectionId: section.id,
                    });
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </section>
      ))}
      {owner && !list.archived && (
        <div className="mt-6">
          {addingSection ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await change(path, "POST", {
                    ...body,
                    title: String(new FormData(e.currentTarget).get("title")),
                  })
                )
                  setAddingSection(false);
              }}
            >
              <input
                name="title"
                aria-label="Section name"
                placeholder="Section name"
                maxLength={300}
                required
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={busy}>
                Add section
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddingSection(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || list.sections.length >= 50}
              onClick={() => setAddingSection(true)}
            >
              <Plus size={16} />
              Add section
            </Button>
          )}
        </div>
      )}
      <details className="mt-10">
        <summary className="text-sm text-slate-500 py-3">
          Completed ({list.tasks.filter((t) => t.completed).length})
        </summary>
        <ul>
          {list.tasks
            .filter((t) => t.completed)
            .map((task) => (
              <li
                key={task.id}
                className="flex gap-3 items-center py-3 text-slate-500"
              >
                <button
                  aria-label={`Reopen ${task.title}`}
                  disabled={disabled}
                  onClick={() =>
                    change("/api/v1/tasks", "PATCH", {
                      ...body,
                      taskId: task.id,
                      completed: false,
                    })
                  }
                  className="rounded-full bg-primary text-white w-6 h-6 shrink-0 flex items-center justify-center disabled:opacity-50"
                >
                  <Check size={15} />
                </button>
                <InlineName
                  value={task.title}
                  label="Task name"
                  editLabel={`Edit ${task.title}`}
                  completed
                  editable={!list.archived}
                  disabled={busy}
                  onSave={(title) =>
                    change("/api/v1/tasks", "PATCH", {
                      ...body,
                      taskId: task.id,
                      title,
                    })
                  }
                />
              </li>
            ))}
        </ul>
      </details>
    </>
  );
}
