"use client";
import { containDialogFocus } from "../../components/dialog-focus";
import { useEffect, useState, useLayoutEffect, useRef } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowDownWideNarrow,
  Layers,
  Columns3,
  X,
} from "lucide-react";
import {
  defaultListView,
  listViewSchema,
  starterViews,
  viewSettings,
  statusLabels,
  taskStatuses,
  taskPriorities,
  viewSorts,
  viewColumns,
  type ListView,
  type TodoList,
} from "@wuff/contracts";
import { Input } from "../../../input";
import { NativeSelect } from "../../../native-select";
import { Button } from "../../../button";
import { ViewPopover } from "./view-popover";
import type { ListChange } from "./list-settings";
import { TaskCapture } from "./task-capture";

export function ListViewControls({
  list,
  userId,
  busy,
  change,
  onPreview,
  shown,
  total,
  retry,
  error = "",
  onCreated,
}: {
  list: TodoList;
  userId: string;
  busy: boolean;
  change: ListChange;
  onPreview: (view: ListView | null) => void;
  shown: number;
  total: number;
  retry?: () => Promise<boolean>;
  error?: string;
  onCreated: (title: string) => void;
}) {
  const optionsDialog = useRef<HTMLDialogElement>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [viewPage, setViewPage] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const sheet = mobile ? { active: viewPage, select: setViewPage } : undefined;
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) optionsDialog.current?.close();
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const measure = () =>
      el.parentElement?.style.setProperty(
        "--view-toolbar-height",
        `${el.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  const saved = list.personalView ?? { version: 0, view: defaultListView() };
  const [draft, setDraft] = useState(saved.view),
    [base, setBase] = useState(saved.version),
    [dirty, setDirty] = useState(false);
  const [naming, setNaming] = useState<"new" | "rename" | null>(null),
    [name, setName] = useState(""),
    [notice, setNotice] = useState(""),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!dirty || JSON.stringify(draft) === JSON.stringify(saved.view)) {
      setDraft(saved.view);
      setBase(saved.version);
      setDirty(false);
      setNotice("");
    }
  }, [saved.version, dirty]);
  useEffect(() => {
    onPreview(dirty ? draft : null);
  }, [draft, dirty, onPreview]);
  const edit = (patch: Partial<ListView>) => {
    setDraft((v) => ({ ...v, ...patch }));
    setDirty(true);
    setNotice("");
  };
  const choices = [
    ...starterViews(userId, list.mode === "work"),
    ...draft.presets,
  ];
  const selected = choices.find((p) => p.id === draft.activePresetId);
  const modified =
    selected &&
    JSON.stringify(selected.settings) !== JSON.stringify(viewSettings(draft));
  const custom = draft.presets.find((p) => p.id === draft.activePresetId);
  const conflict = dirty && base !== saved.version;
  async function save(next = draft) {
    const parsed = listViewSchema.safeParse(next);
    if (!parsed.success) {
      setNotice(parsed.error.issues[0]?.message ?? "Check your view settings.");
      return;
    }
    setDraft(parsed.data);
    setDirty(true);
    if (
      await change(`/api/v1/lists/${list.id}/view`, "PUT", {
        listId: list.id,
        viewVersion: base,
        view: parsed.data,
      })
    ) {
      setDirty(false);
      setNaming(null);
      setDeleting(false);
      setNotice("");
    } else {
      setNotice(
        "Your view wasn’t saved. Your draft is kept; try again or revert to the saved view.",
      );
    }
  }
  const select = (
    label: string,
    value: string,
    options: [string, string][],
    onChange: (value: string) => void,
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
  const chips: { label: string; clear: () => void }[] = [];
  if (draft.search)
    chips.push({
      label: `Search: ${draft.search}`,
      clear: () => edit({ search: "" }),
    });
  if (draft.sections.length)
    chips.push({
      label: `Section: ${draft.sections.map((id) => list.sections.find((s) => s.id === id)?.title ?? "No section").join(", ")}`,
      clear: () => edit({ sections: [] }),
    });
  if (draft.statuses.length)
    chips.push({
      label: `Status: ${draft.statuses.map((s) => statusLabels[s]).join(", ")}`,
      clear: () => edit({ statuses: [] }),
    });
  if (draft.priorities.length)
    chips.push({
      label: `Priority: ${draft.priorities.join(", ")}`,
      clear: () => edit({ priorities: [] }),
    });
  if (draft.assignees.length)
    chips.push({
      label: `Assignee: ${draft.assignees.map((id) => list.assignees.find((a) => a.id === id)?.name ?? "Unassigned").join(", ")}`,
      clear: () => edit({ assignees: [] }),
    });
  if (draft.due !== "all")
    chips.push({
      label: `Due: ${draft.due.replace("_", " ")}`,
      clear: () => edit({ due: "all" }),
    });
  if (draft.completed !== "all")
    chips.push({
      label: draft.completed === "hide" ? "Hide completed" : "Only completed",
      clear: () => edit({ completed: "all" }),
    });
  const presetPicker = (
    <label className="view-preset-picker">
      <span className="sr-only">Saved view</span>
      <NativeSelect
        aria-label="Saved view"
        disabled={busy || dirty}
        value={draft.activePresetId ?? "current"}
        onChange={(e) => {
          const preset = choices.find((p) => p.id === e.target.value);
          if (preset) edit({ ...preset.settings, activePresetId: preset.id });
        }}
      >
        <option value="current">Personal view</option>
        <optgroup label="Starter views">
          {choices
            .filter((p) => !draft.presets.some((c) => c.id === p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </optgroup>
        {!!draft.presets.length && (
          <optgroup label="Your saved views">
            {draft.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </NativeSelect>
    </label>
  );
  const viewTools = (
    <div className="view-toolbar-tools">
      <ViewPopover
        sheet={sheet}
        panelLabel="Filter"
        label={
          <>
            <SlidersHorizontal size={16} />
            Filter{chips.length ? ` · ${chips.length}` : ""}
          </>
        }
        disabled={busy}
      >
        <h3 className="font-bold">Filters</h3>
        <p className="text-xs text-muted-foreground">Only changes your view.</p>
        {select(
          "Section filter",
          draft.sections[0] ?? (draft.sections.length ? "none" : "all"),
          [
            ["all", "All sections"],
            ["none", "No section"],
            ...list.sections.map((s) => [s.id, s.title] as [string, string]),
          ],
          (v) =>
            edit({
              sections: v === "all" ? [] : [v === "none" ? null : v],
            }),
        )}
        {list.mode === "work" && (
          <>
            {select(
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
            {select(
              "Priority filter",
              draft.priorities[0] ?? "all",
              [["all", "All priorities"], ...options(taskPriorities)],
              (v) =>
                edit({
                  priorities:
                    v === "all" ? [] : [v as ListView["priorities"][number]],
                }),
            )}
            {select(
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
          </>
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
      </ViewPopover>
      <ViewPopover
        sheet={sheet}
        panelLabel="Sort"
        label={
          <>
            <ArrowDownWideNarrow size={16} />
            Sort
          </>
        }
        disabled={busy}
      >
        {select(
          "Sort by",
          draft.sortBy,
          [
            ["manual", "Manual"],
            ...(list.mode === "work"
              ? [["priority", "Priority"] as [string, string]]
              : []),
            ["due", "Due date"],
            ["updated", "Recently updated"],
          ],
          (v) => edit({ sortBy: v as ListView["sortBy"] }),
        )}
        {draft.groupBy === "section" && (
          <details>
            <summary className="min-h-11 py-3 text-sm">
              Sorting per section
            </summary>
            <div className="grid gap-3">
              {[{ id: null, title: "No section" }, ...list.sections].map(
                (s) => (
                  <div key={s.id ?? "none"}>
                    {select(
                      `Sort ${s.title}`,
                      draft.sectionSorts.find((o) => o.sectionId === s.id)
                        ?.sortBy ?? "inherit",
                      [["inherit", "Use list sorting"], ...options(viewSorts)],
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
      </ViewPopover>
      <ViewPopover
        sheet={sheet}
        panelLabel="Group"
        label={
          <>
            <Layers size={16} />
            Group
          </>
        }
        disabled={busy}
      >
        {select(
          "Group by",
          draft.groupBy,
          [
            ["section", "Section"],
            ...(list.mode === "work"
              ? [["status", "Status"] as [string, string]]
              : []),
            ["date", "Due date"],
          ],
          (v) => edit({ groupBy: v as ListView["groupBy"] }),
        )}
      </ViewPopover>
      <ViewPopover
        sheet={sheet}
        panelLabel="Display"
        label={
          <>
            <Columns3 size={16} />
            Display
          </>
        }
        disabled={busy}
      >
        {select(
          "Row density",
          draft.layout,
          [
            ["compact", "Compact"],
            ["detailed", "Comfortable"],
          ],
          (v) => edit({ layout: v as ListView["layout"] }),
        )}
        {list.mode === "work" && !mobile && (
          <>
            {select(
              "Row layout",
              draft.rowStyle,
              [
                ["columns", "Columns"],
                ["list", "Simple rows"],
              ],
              (v) => edit({ rowStyle: v as ListView["rowStyle"] }),
            )}
            <fieldset className="grid gap-1">
              <legend className="text-sm mb-1">Visible columns</legend>
              {viewColumns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 min-h-11 text-sm capitalize"
                >
                  <input
                    type="checkbox"
                    checked={draft.columns.includes(column)}
                    onChange={(e) =>
                      edit({
                        columns: viewColumns.filter((c) =>
                          c === column
                            ? e.target.checked
                            : draft.columns.includes(c),
                        ),
                      })
                    }
                  />
                  {column === "due" ? "Due date" : column}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            edit({
              ...viewSettings(defaultListView()),
              activePresetId: "default",
            })
          }
        >
          Reset to defaults
        </Button>
      </ViewPopover>
      <ViewPopover sheet={sheet} label="Saved views" disabled={busy}>
        <p className="text-xs text-muted-foreground">
          Saved views are just for you on this list. Save up to 20.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={draft.presets.length >= 20}
          onClick={() => {
            setName("");
            setNaming("new");
            setDeleting(false);
          }}
        >
          Save as new view…
        </Button>
        {!!custom && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setName(custom.name);
                setNaming("rename");
                setDeleting(false);
              }}
            >
              Rename saved view
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleting(true);
                setNaming(null);
              }}
            >
              Delete saved view
            </Button>
          </>
        )}
        {naming && (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (
                !trimmed ||
                draft.presets.some(
                  (p) =>
                    p.name.toLowerCase() === trimmed.toLowerCase() &&
                    (naming !== "rename" || p.id !== custom?.id),
                )
              ) {
                setNotice("Choose a unique saved view name.");
                return;
              }
              const id =
                naming === "rename" && custom ? custom.id : crypto.randomUUID();
              void save({
                ...draft,
                activePresetId: id,
                presets: [
                  ...draft.presets.filter((p) => p.id !== id),
                  { id, name: trimmed, settings: viewSettings(draft) },
                ],
              });
            }}
          >
            <label className="grid gap-1 text-sm">
              View name
              <Input
                aria-label="View name"
                value={name}
                maxLength={60}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button variant="primary" disabled={busy || conflict}>
              {naming === "rename" ? "Save view name" : "Save new view"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setNaming(null)}
            >
              Cancel
            </Button>
          </form>
        )}
        {deleting && custom && (
          <div className="grid gap-2">
            <p className="text-sm">
              Delete “{custom.name}”? Your tasks stay here.
            </p>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || conflict}
              onClick={() =>
                void save({
                  ...draft,
                  presets: draft.presets.filter((p) => p.id !== custom.id),
                  activePresetId: null,
                })
              }
            >
              Confirm delete saved view
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleting(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </ViewPopover>
    </div>
  );
  const filterChips = (
    <div className="view-filter-chips">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          disabled={busy}
          onClick={chip.clear}
          title={chip.label}
          className="view-filter-chip"
          aria-label={`Clear ${chip.label}`}
        >
          <span>{chip.label}</span>
          <X size={12} />
        </button>
      ))}
      {!!chips.length && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            edit({
              search: "",
              sections: [],
              statuses: [],
              priorities: [],
              assignees: [],
              due: "all",
              completed: "all",
            })
          }
        >
          Clear filters
        </Button>
      )}
    </div>
  );
  const viewState = (
    <div className="view-toolbar-state">
      {filterChips}
      <p role="status" className="text-xs text-muted-foreground">
        {shown} of {total} tasks shown ·{" "}
        {draft.sortBy === "manual"
          ? "Manual order"
          : "Sorted view · Dragging off"}
        {modified ? " · Modified saved view" : ""}
        {dirty ? " · Unsaved changes" : ""}
      </p>
      {dirty && (
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="primary"
            disabled={busy || conflict}
            onClick={() =>
              void save(
                custom
                  ? {
                      ...draft,
                      presets: draft.presets.map((p) =>
                        p.id === custom.id
                          ? { ...p, settings: viewSettings(draft) }
                          : p,
                      ),
                    }
                  : draft,
              )
            }
          >
            Save view
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setDraft(saved.view);
              setBase(saved.version);
              setDirty(false);
              setNotice("");
            }}
          >
            Revert to saved view
          </Button>
        </div>
      )}
      {mobile && retry && (
        <div className="grid gap-2">
          <p role="alert" className="text-sm">
            We couldn’t confirm your previous change. Retry the same request to
            check and finish it.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (await retry()) setNotice("");
            }}
          >
            Retry same request
          </Button>
        </div>
      )}
      {conflict && (
        <p role="alert" className="text-sm">
          Your view changed elsewhere. Your draft is kept. Revert to the saved
          view to load the latest version.
        </p>
      )}
      {notice && (
        <p role="alert" className="text-sm">
          {notice}
        </p>
      )}
    </div>
  );
  return (
    <div
      ref={toolbarRef}
      className="workspace-view-toolbar"
      aria-label="List toolbar"
    >
      <div className="view-toolbar-line">
        {!mobile && presetPicker}
        <label className="view-search">
          <Search size={16} aria-hidden="true" />
          <Input
            aria-label="Search title or key"
            placeholder="Search tasks…"
            value={draft.search}
            maxLength={300}
            readOnly={busy}
            onChange={(e) => edit({ search: e.target.value })}
          />
        </label>
        {mobile ? (
          <Button
            type="button"
            variant="outline"
            className="mobile-view-trigger"
            onClick={() => {
              optionsDialog.current?.showModal();
              setOptionsOpen(true);
            }}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            View{chips.length ? ` · ${chips.length}` : ""}
            {dirty && (
              <span aria-label="Unsaved changes" className="view-draft-dot" />
            )}
          </Button>
        ) : (
          viewTools
        )}
        <TaskCapture
          list={list}
          busy={busy}
          change={change}
          error={error}
          retry={retry}
          onCreated={onCreated}
        />
      </div>
      {mobile ? (
        <>
          {!!chips.length && !optionsOpen && (
            <div className="mobile-filter-recovery">{filterChips}</div>
          )}
          {(shown !== total || dirty) && (
            <p role="status" className="mobile-view-summary">
              {shown} of {total} tasks{dirty ? " · View changes not saved" : ""}
            </p>
          )}
          <dialog
            onKeyDown={containDialogFocus}
            ref={optionsDialog}
            aria-labelledby="mobile-view-title"
            className="mobile-view-dialog"
            onClose={() => {
              setOptionsOpen(false);
              setViewPage(null);
            }}
            onCancel={(e) => {
              if (busy) e.preventDefault();
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 id="mobile-view-title" className="text-xl font-bold">
                Your view
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close view options"
                disabled={busy}
                onClick={() => optionsDialog.current?.close()}
              >
                <X size={20} />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Filters, sorting and display. Only changes your view.
            </p>
            {!viewPage && presetPicker}
            {viewTools}
            {viewState}
            <Button
              type="button"
              variant="ghost"
              className="w-full mt-3"
              disabled={busy}
              onClick={() => optionsDialog.current?.close()}
            >
              Done
            </Button>
          </dialog>
        </>
      ) : (
        viewState
      )}
      {shown === 0 && (
        <p className="list-empty-message" role="status">
          {total === 0
            ? list.archived
              ? "This archived list has no tasks."
              : "No tasks yet. Add your first task."
            : chips.length
              ? draft.search
                ? "No tasks match your search. Clear the search or filters to see your tasks."
                : "No tasks match these filters. Clear filters to see your tasks."
              : "No tasks to show."}
        </p>
      )}
    </div>
  );
}
