"use client";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";

import { wuffCopy, taskCount } from "@/lib/copy";
import { useEffect, useRef, useState } from "react";
import { Check, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  defaultListView,
  projectListView,
  type TodoList,
  type ViewGroup,
} from "@wuff/contracts";
import { ListViewControls } from "./list-view-controls";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
import { type NoteDraft } from "./task-notes";
import { TaskRow } from "./task-row";
import { SortableList, SortableItem } from "@/components/sortable";
import { mergeVisibleOrder } from "@/lib/reorder";
import { useCalendarDay } from "@/lib/use-calendar-day";
import type { DueDateDraft } from "./task-due-date";
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
  const today = useCalendarDay();
  const dueDrafts = useRef(new Map<string, DueDateDraft>());
  const noteDrafts = useRef(new Map<string, NoteDraft>()),
    subtaskDrafts = useRef(new Map<string, string>());
  useEffect(() => {
    for (const id of noteDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id)) noteDrafts.current.delete(id);
    for (const id of subtaskDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id))
        subtaskDrafts.current.delete(id);
    for (const id of dueDrafts.current.keys())
      if (!list.tasks.some((t) => t.id === id)) dueDrafts.current.delete(id);
  }, [list.tasks]);
  const [addingSection, setAddingSection] = useState(false);
  const owner = list.ownerId === userId,
    disabled = busy || list.archived;
  const body = { listId: list.id, version: list.version };
  const path = `/api/v1/lists/${list.id}/sections`;
  const view = list.personalView?.view ?? defaultListView();
  const groups = projectListView(list, view, today ?? "0001-01-01");
  const active = list.tasks.filter((t) => !t.parentTaskId);
  const saveCollapsed = (id: string, open: boolean) => {
    const collapsed = open
      ? view.collapsed.filter((v) => v !== id)
      : [...new Set([...view.collapsed, id])].slice(-200);
    if (JSON.stringify(collapsed) !== JSON.stringify(view.collapsed))
      void change(`/api/v1/lists/${list.id}/view`, "PUT", {
        listId: list.id,
        viewVersion: list.personalView?.version ?? 0,
        view: { ...view, collapsed },
      });
  };
  function rows(sectionId: string | null, group?: ViewGroup) {
    group ??= groups.find((g) => g.sectionId === sectionId);
    const items = group?.tasks ?? [];
    const manual = group?.sortBy === "manual";
    const childMatches = group?.childMatches ?? {};
    return (
      <SortableList
        items={items}
        disabled={disabled || !manual}
        onReorder={async (ids, before) => {
          const taskIds = mergeVisibleOrder(
            active.filter((t) => !t.completed).map((t) => t.id),
            before.filter((id) =>
              active.some((t) => t.id === id && !t.completed),
            ),
            ids.filter((id) => active.some((t) => t.id === id && !t.completed)),
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
              disabled={disabled || !manual || task.completed}
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
                  subtaskDrafts={subtaskDrafts.current}
                  dueDrafts={dueDrafts.current}
                  today={today}
                  detailed={view.layout === "detailed"}
                  matchedChildren={childMatches[task.id]}
                  disableChildDrag={!manual}
                  dragHandle={
                    !list.archived && manual && !task.completed
                      ? handle
                      : undefined
                  }
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
          className="task-add flex gap-2 mt-4"
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
          <InputGroup>
            <InputGroupInput
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
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                variant="ghost"
                disabled={disabled}
                type="submit"
                title="Add task"
                aria-label={
                  sectionId
                    ? `Add task to ${list.sections.find((s) => s.id === sectionId)?.title}`
                    : "Add task"
                }
              >
                <Plus size={20} />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
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
      <ListViewControls list={list} busy={busy} change={change} />
      <p className="text-sm text-slate-500 mb-5">
        {active.filter((t) => !t.completed).length === 0 &&
        list.tasks.some((t) => t.parentTaskId && !t.completed)
          ? "Main tasks fetched! Some subtasks still need a paw."
          : taskCount(active.filter((t) => !t.completed).length)}
      </p>
      <p role="status" className="text-xs text-slate-500 mb-3">
        {groups.reduce((n, g) => n + g.tasks.length, 0)} main tasks shown ·{" "}
        {view.sortBy === "manual"
          ? "Manual order"
          : "Dragging off while sorted"}
      </p>
      {view.groupBy !== "section" ? (
        <>
          {groups
            .filter((g) => g.tasks.length)
            .map((g) => (
              <details
                key={g.id}
                open={!view.collapsed.includes(g.id)}
                onToggle={(e) => saveCollapsed(g.id, e.currentTarget.open)}
                className="mt-5"
              >
                <summary className="font-semibold py-3">
                  {g.title} ({g.tasks.length})
                </summary>
                {rows(null, g)}
              </details>
            ))}
          {addTask(null)}
        </>
      ) : (
        <>
          {list.sections.length > 0 && (
            <h2 className="text-lg font-bold mb-1">No section</h2>
          )}
          <details
            open={!view.collapsed.includes("section:none")}
            onToggle={(e) =>
              saveCollapsed("section:none", e.currentTarget.open)
            }
          >
            <summary className="text-xs py-2 min-h-11">
              Tasks (
              {groups.find((g) => g.sectionId === null)?.tasks.length ?? 0})
            </summary>
            {rows(null)}
            {addTask(null)}
          </details>
          <SortableList
            items={list.sections}
            disabled={busy || !owner || list.archived}
            onReorder={(sectionIds) =>
              change(path, "PUT", { ...body, sectionIds })
            }
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
                      <details
                        open={!view.collapsed.includes(`section:${section.id}`)}
                        onToggle={(e) =>
                          saveCollapsed(
                            `section:${section.id}`,
                            e.currentTarget.open,
                          )
                        }
                        className="min-w-0 flex-1 group/section"
                      >
                        <summary className="text-xs font-medium text-slate-500 py-2 min-h-11">
                          Tasks (
                          {groups.find((g) => g.sectionId === section.id)?.tasks
                            .length ?? 0}
                          )
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
        </>
      )}
      {owner && !list.archived && (
        <div className="mt-6">
          {addingSection ? (
            <form
              className="min-w-0"
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
              <InputGroup>
                <InputGroupInput
                  name="title"
                  aria-label="Section name"
                  placeholder={wuffCopy.sectionPlaceholder}
                  maxLength={300}
                  required
                  autoFocus
                  className="flex-1"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="submit"
                    size="icon-sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label="Save section"
                    title="Save section"
                  >
                    <Check size={18} />
                  </InputGroupButton>
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancel section"
                    title="Cancel section"
                    onClick={() => setAddingSection(false)}
                  >
                    <X size={18} />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          ) : (
            <Button
              variant="ghost"
              className="px-2 text-slate-600"
              aria-label="Add section"
              title="Add section"
              disabled={busy || list.sections.length >= 50}
              onClick={() => setAddingSection(true)}
            >
              <ListPlus size={18} aria-hidden="true" />
              <span>Add section</span>
            </Button>
          )}
        </div>
      )}
    </>
  );
}
