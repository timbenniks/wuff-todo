"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ListTodo, Star, Users } from "lucide-react";
import { sidebarGroups, type ListSummary } from "@wuff/contracts";
import { Button } from "../../../button";
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
  toggle,
  pending,
}: {
  lists: ListSummary[];
  archived: boolean;
  selectedId: string;
  disabled: boolean;
  choose: (id: string) => void;
  preload: (id: string) => void;
  reorder: (next: string[], before: string[]) => Promise<boolean>;
  toggle: (id: string, collapsed: boolean) => Promise<boolean>;
  pending?: { id: string; status: "saving" | "failed" } | null;
}) {
  const groups = sidebarGroups(lists, archived);
  const [collapsedSelection, setCollapsedSelection] = useState("");
  useEffect(() => setCollapsedSelection(""), [selectedId]);
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
      {!archived && lists.some((list) => list.favorite && !list.archived) && (
        <section className="mb-5" aria-labelledby="favorite-lists-heading">
          <h3
            id="favorite-lists-heading"
            className="text-xs font-bold text-muted-foreground mb-2"
          >
            Favorites
          </h3>
          <nav aria-label="Favorite lists" className="grid gap-1">
            {lists
              .filter((list) => list.favorite && !list.archived)
              .map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => choose(list.id)}
                  onPointerEnter={() => preload(list.id)}
                  onFocus={() => preload(list.id)}
                  aria-current={list.id === selectedId ? "page" : undefined}
                  className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-3 text-left text-sm ${list.id === selectedId ? "shadow-sm font-semibold" : "hover:bg-surface/60"}`}
                  style={{
                    background:
                      list.id === selectedId
                        ? listPalette[list.color].tint
                        : undefined,
                  }}
                >
                  <Star
                    size={17}
                    className="shrink-0"
                    style={{ color: listPalette[list.color].accent }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{list.title}</span>
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
              ))}
          </nav>
        </section>
      )}
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
    </>
  );
}
