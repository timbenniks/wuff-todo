"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import {
  sidebarGroups,
  listNavigationContext,
  type ListSummary,
} from "@wuff/contracts";
import { Button } from "../../../../button";
import { SortableItem, SortableList } from "../../components/sortable";
import { listPalette } from "../../lib/list-colors";

export function SidebarLists({
  controls,
  lists,
  archived,
  selectedId,
  disabled,
  choose,
  preload,
  reorder,
  toggle,
  pending,
  actions,
}: {
  actions?: (list: ListSummary) => ReactNode;
  controls?: ReactNode;
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
  const tree = useRef<HTMLElement>(null);
  const groups = sidebarGroups(lists, archived);
  useEffect(() => {
    const scroller = tree.current?.closest<HTMLElement>(".workspace-list-nav");
    // The desktop tree flows with the page. Only reveal selection inside an
    // actual navigation scroller (the phone sheet), never move the document.
    if (
      !scroller ||
      !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)
    )
      return;
    tree.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  const [collapsedSelection, setCollapsedSelection] = useState("");
  useEffect(() => setCollapsedSelection(""), [selectedId]);
  function row(
    list: ListSummary,
    children: ListSummary[] = [],
    shortcut = false,
    nested = false,
  ): ReactNode {
    const expanded =
      !list.sidebarCollapsed ||
      (collapsedSelection !== selectedId &&
        children.some((child) => child.id === selectedId));
    const groupId = `${shortcut ? "favorite" : "tree"}-children-${list.id}`;
    const parent =
      shortcut && !nested ? listNavigationContext(lists, list.id).parent : null;
    function content(handle?: ReactNode) {
      return (
        <>
          <div className="sidebar-list-row">
            <span className="sidebar-disclosure">
              {children.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${list.title}`}
                  aria-expanded={expanded}
                  aria-controls={groupId}
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
            </span>
            <button
              type="button"
              title={list.title}
              onClick={() => choose(list.id)}
              onPointerEnter={() => preload(list.id)}
              onFocus={() => preload(list.id)}
              aria-current={list.id === selectedId ? "page" : undefined}
              className="sidebar-list-link"
            >
              <span
                className="list-color-marker"
                style={{ background: listPalette[list.color].accent }}
                aria-hidden="true"
              />
              <span className="sidebar-list-name">
                <span>{list.title}</span>
                {parent && <small>In {parent.title}</small>}
              </span>
              {pending?.id === list.id && (
                <span className="text-xs text-muted-foreground">
                  {pending.status === "saving" ? "Saving…" : "Retry"}
                </span>
              )}
              {list.shared && (
                <span className="sidebar-shared" title="Shared list">
                  <Users size={15} aria-hidden="true" />
                  <span className="sr-only">Shared list</span>
                </span>
              )}
            </button>
            {handle && <span className="sidebar-reorder">{handle}</span>}
            {!shortcut && actions && (
              <span className="sidebar-row-actions">{actions(list)}</span>
            )}
          </div>
          {children.length > 0 && (
            <div id={groupId} hidden={!expanded} className="sidebar-children">
              {shortcut ? (
                <div role="group" aria-label={`Lists under ${list.title}`}>
                  {children.map((child) => row(child, [], true, true))}
                </div>
              ) : (
                <SortableList
                  items={children}
                  disabled={disabled}
                  onReorder={reorder}
                >
                  <div role="group" aria-label={`Lists under ${list.title}`}>
                    {children.map((child) => row(child, [], false, true))}
                  </div>
                </SortableList>
              )}
            </div>
          )}
        </>
      );
    }
    if (shortcut)
      return (
        <div key={list.id} className="sidebar-shortcut">
          {content()}
        </div>
      );
    return (
      <SortableItem
        key={list.id}
        id={list.id}
        title={`list ${list.title}`}
        disabled={disabled}
      >
        {({ ref, style, handle }) => (
          <div ref={ref} style={style} className="min-w-0">
            {content(handle)}
          </div>
        )}
      </SortableItem>
    );
  }
  const favorites = lists.filter((list) => list.favorite && !list.archived);
  return (
    <>
      {!archived && favorites.length > 0 && (
        <section
          className="sidebar-favorites mb-4"
          aria-labelledby="favorite-lists-heading"
        >
          <h3 id="favorite-lists-heading" className="sidebar-group-label">
            Favorites
          </h3>
          <nav aria-label="Favorite lists">
            {favorites.map((list) => row(list, [], true))}
          </nav>
        </section>
      )}
      {controls}
      <nav ref={tree} aria-label={archived ? "Archived lists" : "Lists"}>
        <SortableList
          items={groups.map((group) => group.list)}
          disabled={disabled}
          onReorder={reorder}
        >
          <div>{groups.map((group) => row(group.list, group.children))}</div>
        </SortableList>
      </nav>
    </>
  );
}
