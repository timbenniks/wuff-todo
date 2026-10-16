"use client";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { TodoList } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
import { type NoteDraft } from "./task-notes";
import { TaskRow } from "./task-row";
import { SortableList, SortableItem } from "@/components/sortable";
import { mergeVisibleOrder } from "@/lib/reorder";
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
  const noteDrafts = useRef(new Map<string, NoteDraft>()),
    completedGroup = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    for (const id of noteDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id)) noteDrafts.current.delete(id);
    if (
      list.tasks.some((t) => t.completed && noteDrafts.current.has(t.id)) &&
      completedGroup.current
    )
      completedGroup.current.open = true;
  }, [list.tasks]);
  const [addingSection, setAddingSection] = useState(false);
  const owner = list.ownerId === userId,
    disabled = busy || list.archived;
  const body = { listId: list.id, version: list.version };
  const path = `/api/v1/lists/${list.id}/sections`;
  const active = list.tasks.filter((t) => !t.completed);
  function rows(sectionId: string | null) {
    const items = active.filter((t) => t.sectionId === sectionId);
    return (
      <SortableList
        items={items}
        disabled={disabled}
        onReorder={async (ids, before) => {
          const taskIds = mergeVisibleOrder(
            active.map((t) => t.id),
            before,
            ids,
          );
          if (taskIds)
            return await change("/api/v1/tasks", "PUT", { ...body, taskIds });
          return false;
        }}
      >
        <ul
          aria-label={
            sectionId
              ? `Tasks in ${list.sections.find((s) => s.id === sectionId)?.title}`
              : "Active tasks"
          }
          className="divide-y divide-border"
        >
          {items.map((task) => (
            <SortableItem
              key={task.id}
              id={task.id}
              title={task.title}
              disabled={disabled}
            >
              {({ ref, style, handle }) => (
                <TaskRow
                  userId={userId}
                  rowRef={ref}
                  style={style}
                  task={task}
                  list={list}
                  busy={busy}
                  change={change}
                  drafts={noteDrafts.current}
                  dragHandle={!list.archived ? handle : undefined}
                />
              )}
            </SortableItem>
          ))}
        </ul>
      </SortableList>
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
            placeholder="What’s next for your pack?"
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
  return (
    <>
      {list.archived && (
        <p
          role="status"
          className="rounded-xl border border-border bg-white p-4 text-sm mb-6"
        >
          This list is taking a paws in the archive.{" "}
          {owner
            ? "Restore it in List settings to make changes."
            : "Its owner can restore it so you can make changes again."}
        </p>
      )}
      <p className="text-sm text-slate-500 mb-5">
        {active.length} things to fetch and finish
      </p>
      {list.sections.length > 0 && (
        <h2 className="text-lg font-bold mb-1">No section</h2>
      )}
      {rows(null)}
      {addTask(null)}
      <SortableList
        items={list.sections}
        disabled={busy || !owner || list.archived}
        onReorder={(sectionIds) => change(path, "PUT", { ...body, sectionIds })}
      >
        {list.sections.map((section) => (
          <SortableItem
            key={section.id}
            id={section.id}
            title={`section ${section.title}`}
            disabled={busy || !owner || list.archived}
          >
            {({ ref, style, handle }) => (
              <section
                ref={ref}
                style={style}
                className="mt-8 border-t border-border pt-4"
              >
                <div className="flex items-center gap-2">
                  <InlineName
                    value={section.title}
                    heading="h2"
                    label="Section name"
                    editLabel={`Rename section ${section.title}`}
                    editable={owner && !list.archived}
                    disabled={busy}
                    onSave={(title) =>
                      change(path, "PATCH", {
                        ...body,
                        sectionId: section.id,
                        title,
                      })
                    }
                    renderActions={
                      owner && !list.archived
                        ? ({ edit, editing, trigger }) => (
                            <div className="flex items-center">
                              <Button
                                ref={trigger}
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label={`Rename section ${section.title}`}
                                title="Rename section"
                                disabled={busy || editing}
                                onClick={edit}
                              >
                                <Pencil size={15} />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-red-700"
                                disabled={busy || editing}
                                title="Remove section"
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
                              {handle}
                            </div>
                          )
                        : undefined
                    }
                  />
                </div>
                <div className="mt-1">
                  <details open className="min-w-0 flex-1 group/section">
                    <summary className="text-xs font-medium text-slate-500 py-2">
                      Tasks (
                      {active.filter((t) => t.sectionId === section.id).length})
                    </summary>
                    <div className="mt-1">
                      {rows(section.id)}
                      {addTask(section.id)}
                    </div>
                  </details>
                </div>
              </section>
            )}
          </SortableItem>
        ))}
      </SortableList>
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
      <details className="mt-10" ref={completedGroup}>
        <summary className="text-sm text-slate-500 py-3">
          Paw-some, completed ({list.tasks.filter((t) => t.completed).length})
        </summary>
        <ul>
          {list.tasks
            .filter((t) => t.completed)
            .map((task) => (
              <TaskRow
                userId={userId}
                key={task.id}
                task={task}
                list={list}
                busy={busy}
                change={change}
                drafts={noteDrafts.current}
              />
            ))}
        </ul>
      </details>
    </>
  );
}
