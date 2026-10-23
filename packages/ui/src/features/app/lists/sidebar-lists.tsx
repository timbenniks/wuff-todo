"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  ListTodo,
  Users,
  X,
} from "lucide-react";
import { sidebarGroups, type ListSummary } from "@wuff/contracts";
import { Button } from "../../../button";
import { NativeSelect } from "../../../native-select";
import { SortableItem, SortableList } from "../../components/sortable";
import { listPalette } from "../../lib/list-colors";

export function SidebarLists({
  lists,
  archived,
  selectedId,
  disabled,
  choose,
  preload,
  reorder,
  move,
  toggle,
  error,
  busy,
  retry,
  pending,
}: {
  lists: ListSummary[];
  archived: boolean;
  selectedId: string;
  disabled: boolean;
  choose: (id: string) => void;
  preload: (id: string) => void;
  reorder: (next: string[], before: string[]) => Promise<boolean>;
  move: (id: string, parentId: string | null) => Promise<boolean>;
  toggle: (id: string, collapsed: boolean) => Promise<boolean>;
  busy: boolean;
  retry?: () => Promise<boolean>;
  pending?: { id: string; status: "saving" | "failed" } | null;
  error: string;
}) {
  const groups = sidebarGroups(lists, archived);
  const dialog = useRef<HTMLDialogElement>(null);
  const [movingId, setMovingId] = useState("");
  const [parentId, setParentId] = useState("");
  const [failed, setFailed] = useState(false);
  const [collapsedSelection, setCollapsedSelection] = useState("");
  useEffect(() => setCollapsedSelection(""), [selectedId]);
  const moving = lists.find((list) => list.id === movingId);
  const hasChildren = lists.some((list) => list.parentListId === movingId);
  const candidates = lists.filter(
    (list) =>
      list.id !== movingId &&
      !list.parentListId &&
      list.archived === moving?.archived,
  );
  function openMove(list: ListSummary) {
    setMovingId(list.id);
    setParentId(list.parentListId ?? "");
    setFailed(false);
    dialog.current?.showModal();
  }
  function row(list: ListSummary, children: ListSummary[] = []) {
    // Keep a directly opened child discoverable even if its parent was collapsed.
    const expanded =
      !list.sidebarCollapsed ||
      (collapsedSelection !== selectedId &&
        children.some((child) => child.id === selectedId));
    return (
      <SortableItem
        key={list.id}
        id={list.id}
        title={`list ${list.title}`}
        disabled={disabled}
      >
        {({ ref, style, handle }) => (
          <div ref={ref} style={style} className="min-w-0">
            <div className="flex min-w-0 items-center gap-0.5">
              {children.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  disabled={disabled}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${list.title}`}
                  aria-expanded={expanded}
                  aria-controls={`child-lists-${list.id}`}
                  onClick={() => {
                    setCollapsedSelection(expanded ? selectedId : "");
                    void toggle(list.id, expanded);
                  }}
                >
                  {expanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </Button>
              )}
              <button
                type="button"
                onClick={() => choose(list.id)}
                onPointerEnter={() => preload(list.id)}
                onFocus={() => preload(list.id)}
                aria-current={list.id === selectedId ? "page" : undefined}
                className={`flex flex-1 min-w-0 items-center gap-2 text-left rounded-xl px-2 py-3 text-sm ${list.id === selectedId ? "shadow-sm font-semibold" : "hover:bg-surface/60"}`}
                style={{
                  background:
                    list.id === selectedId
                      ? listPalette[list.color].tint
                      : undefined,
                }}
              >
                <ListTodo
                  size={17}
                  className="shrink-0"
                  style={{ color: listPalette[list.color].accent }}
                />
                <span className="truncate">{list.title}</span>
                {pending?.id === list.id && (
                  <span className="text-xs text-muted-foreground">
                    {pending.status === "saving" ? "Saving…" : "Retry"}
                  </span>
                )}
                {list.shared && (
                  <span
                    className="ml-auto inline-flex shrink-0 text-muted-foreground"
                    title="Shared list"
                  >
                    <Users size={16} aria-hidden="true" />
                    <span className="sr-only">Shared list</span>
                  </span>
                )}
              </button>
              {handle}
            </div>
            {children.length > 0 && (
              <div
                id={`child-lists-${list.id}`}
                hidden={!expanded}
                className="ml-4 border-l border-border pl-1"
              >
                <SortableList
                  items={children}
                  disabled={disabled}
                  onReorder={reorder}
                >
                  <div
                    className="grid gap-1"
                    role="group"
                    aria-label={`Lists under ${list.title}`}
                  >
                    {children.map((child) => row(child))}
                  </div>
                </SortableList>
              </div>
            )}
          </div>
        )}
      </SortableItem>
    );
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 justify-start"
        disabled={disabled || !lists.length}
        onClick={() => {
          const list =
            lists.find((list) => list.id === selectedId) ?? groups[0]?.list;
          if (list) openMove(list);
        }}
      >
        <FolderInput size={16} /> Move list
      </Button>
      <nav aria-label={archived ? "Archived lists" : "Lists"}>
        <SortableList
          items={groups.map((group) => group.list)}
          disabled={disabled}
          onReorder={reorder}
        >
          <div className="grid gap-1">
            {groups.map((group) => row(group.list, group.children))}
          </div>
        </SortableList>
      </nav>
      <dialog
        ref={dialog}
        aria-labelledby="move-list-heading"
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-surface text-foreground p-6 shadow-xl backdrop:bg-slate-900/30"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (disabled || !moving) return;
            setFailed(false);
            if (await move(moving.id, parentId || null))
              dialog.current?.close();
            else setFailed(true);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="move-list-heading" className="text-xl font-bold">
              Move list
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close move list"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              <X size={18} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Arrange your sidebar. Tasks, subtasks and sharing stay with each
            list. Only your sidebar changes.
          </p>
          <div className="grid gap-2 text-sm font-semibold">
            <label htmlFor="sidebar-moving-list">List</label>
            <NativeSelect
              id="sidebar-moving-list"
              value={movingId}
              disabled={disabled}
              onChange={(e) => {
                const list = lists.find((list) => list.id === e.target.value)!;
                setMovingId(list.id);
                setParentId(list.parentListId ?? "");
                setFailed(false);
              }}
            >
              {lists
                .filter((list) => list.archived === archived)
                .map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2 text-sm font-semibold">
            <label htmlFor="sidebar-parent-list">Parent list</label>
            <NativeSelect
              id="sidebar-parent-list"
              value={parentId}
              disabled={disabled || hasChildren}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Top level</option>
              {candidates.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          {hasChildren && (
            <p className="text-sm text-muted-foreground">
              This list has child lists. Move those first to keep one level of
              nesting.
            </p>
          )}
          {(failed || retry) && (
            <p role="alert" className="text-sm text-red-800">
              {error ||
                "Your move wasn’t saved. Check the sidebar message and try again."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
            {retry && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (await retry()) dialog.current?.close();
                }}
              >
                Retry sidebar change
              </Button>
            )}
            <Button variant="primary" disabled={disabled || !moving}>
              {disabled ? "Moving…" : "Save location"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
