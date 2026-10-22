"use client";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  defaultListView,
  statusLabels,
  taskStatuses,
  taskPriorities,
  viewSorts,
  type ListView,
  type TodoList,
} from "@wuff/contracts";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import type { ListChange } from "./list-settings";
export function ListViewControls({
  list,
  busy,
  change,
}: {
  list: TodoList;
  busy: boolean;
  change: ListChange;
}) {
  const saved = list.personalView ?? { version: 0, view: defaultListView() };
  const [draft, setDraft] = useState(saved.view),
    [base, setBase] = useState(saved.version),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setDraft(saved.view);
      setBase(saved.version);
    }
  }, [saved.version, dirty]);
  const edit = (patch: Partial<ListView>) => {
    setDraft((v) => ({ ...v, ...patch }));
    setDirty(true);
  };
  const select = (
    label: string,
    value: string,
    options: [string, string][],
    onChange: (v: string) => void,
  ) => (
    <label className="grid gap-1 text-sm min-w-0">
      <span>{label}</span>
      <NativeSelect
        aria-label={label}
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
  const options = (values: readonly string[]) =>
    values.map((v) => [v, v[0].toUpperCase() + v.slice(1)] as [string, string]);
  return (
    <div className="list-view-toolbar">
      <div
        className="task-density-control"
        role="group"
        aria-label="Task density"
      >
        {(
          [
            ["compact", "Compact"],
            ["detailed", "Comfortable"],
          ] as const
        ).map(([layout, label]) => (
          <Button
            key={layout}
            type="button"
            variant="ghost"
            aria-pressed={saved.view.layout === layout}
            disabled={busy || dirty}
            onClick={() => {
              if (saved.view.layout !== layout)
                void change(`/api/v1/lists/${list.id}/view`, "PUT", {
                  listId: list.id,
                  viewVersion: saved.version,
                  view: { ...saved.view, layout },
                });
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <details className="list-view-controls view-disclosure">
        <summary className="flex items-center gap-2 text-sm font-medium min-h-11 cursor-pointer">
          <ChevronRight aria-hidden="true" size={16} className="shrink-0" />
          <span>Your view{dirty ? " · Unsaved changes" : ""}</span>
        </summary>
        <form
          className="pt-1 pb-3 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await change(`/api/v1/lists/${list.id}/view`, "PUT", {
                listId: list.id,
                viewVersion: base,
                view: draft,
              })
            )
              setDirty(false);
          }}
        >
          <p className="text-xs text-muted-foreground">
            Only changes how you see this list.
          </p>
          {base !== saved.version && dirty && (
            <p role="status" className="text-sm text-amber-800">
              Your saved view changed elsewhere. Reload the saved view before
              applying changes.
            </p>
          )}
          <label className="grid gap-1 text-sm">
            Search title or key
            <Input
              aria-label="Search title or key"
              className="rounded-md border px-3 py-2 min-h-11 text-base w-full"
              maxLength={300}
              readOnly={busy}
              value={draft.search}
              onChange={(e) => edit({ search: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {select(
              "Section filter",
              draft.sections[0] ?? (draft.sections.length ? "none" : "all"),
              [
                ["all", "All sections"],
                ["none", "No section"],
                ...list.sections.map(
                  (s) => [s.id, s.title] as [string, string],
                ),
              ],
              (v) =>
                edit({
                  sections: v === "all" ? [] : [v === "none" ? null : v],
                }),
            )}
            {list.mode === "work" &&
              select(
                "Status filter",
                draft.statuses[0] ?? "all",
                [
                  ["all", "All statuses"],
                  ...taskStatuses.map(
                    (s) => [s, statusLabels[s]] as [string, string],
                  ),
                ],
                (v) =>
                  edit({
                    statuses:
                      v === "all" ? [] : [v as ListView["statuses"][number]],
                  }),
              )}
            {list.mode === "work" &&
              select(
                "Priority filter",
                draft.priorities[0] ?? "all",
                [["all", "All priorities"], ...options(taskPriorities)],
                (v) =>
                  edit({
                    priorities:
                      v === "all" ? [] : [v as ListView["priorities"][number]],
                  }),
              )}
            {!!list.assignees.length &&
              select(
                "Assignee filter",
                draft.assignees[0] ?? (draft.assignees.length ? "none" : "all"),
                [
                  ["all", "Anyone"],
                  ["none", "Unassigned"],
                  ...list.assignees.map(
                    (a) => [a.id, a.name] as [string, string],
                  ),
                ],
                (v) =>
                  edit({
                    assignees: v === "all" ? [] : [v === "none" ? null : v],
                  }),
              )}
            {select(
              "Due date filter",
              draft.due,
              [
                ["all", "Any due date"],
                ["overdue", "Before today"],
                ["today", "Today"],
                ["upcoming", "After today"],
                ["no_date", "No due date"],
              ],
              (v) => edit({ due: v as ListView["due"] }),
            )}
            {select(
              "Completed tasks",
              draft.completed,
              [
                ["all", "Include completed"],
                ["hide", "Hide completed"],
                ["only", "Only completed"],
              ],
              (v) => edit({ completed: v as ListView["completed"] }),
            )}
            {select(
              "Group by",
              draft.groupBy,
              [
                ["section", "Section"],
                ["status", "Status"],
                ["date", "Due date"],
              ],
              (v) => edit({ groupBy: v as ListView["groupBy"] }),
            )}
            {select(
              "Sort by",
              draft.sortBy,
              [
                ["manual", "Manual"],
                ["priority", "Priority"],
                ["due", "Due date"],
                ["updated", "Recently updated"],
              ],
              (v) => edit({ sortBy: v as ListView["sortBy"] }),
            )}
            {select(
              "Density",
              draft.layout,
              [
                ["compact", "Compact"],
                ["detailed", "Comfortable"],
              ],
              (v) => edit({ layout: v as ListView["layout"] }),
            )}
          </div>
          {draft.groupBy === "section" && (
            <details className="view-disclosure">
              <summary className="flex items-center gap-2 text-sm min-h-11">
                <ChevronRight
                  aria-hidden="true"
                  size={16}
                  className="shrink-0"
                />
                <span>Sorting per section</span>
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {[{ id: null, title: "No section" }, ...list.sections].map(
                  (s) => (
                    <div key={s.id ?? "none"}>
                      {select(
                        `Sort ${s.title}`,
                        draft.sectionSorts.find((o) => o.sectionId === s.id)
                          ?.sortBy ?? "inherit",
                        [
                          ["inherit", "Use list sorting"],
                          ...options(viewSorts),
                        ],
                        (v) =>
                          edit({
                            sectionSorts: [
                              ...draft.sectionSorts.filter(
                                (o) => o.sectionId !== s.id,
                              ),
                              ...(v === "inherit"
                                ? []
                                : [
                                    {
                                      sectionId: s.id,
                                      sortBy: v as ListView["sortBy"],
                                    },
                                  ]),
                            ],
                          }),
                      )}
                    </div>
                  ),
                )}
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy || base !== saved.version}>
              Apply view
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDraft(saved.view);
                setBase(saved.version);
                setDirty(false);
              }}
            >
              Reload saved view
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => edit(defaultListView())}
            >
              Reset to defaults
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}
