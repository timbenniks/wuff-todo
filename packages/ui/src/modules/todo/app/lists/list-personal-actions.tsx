"use client";
import { MoreHorizontal, Star, FolderInput } from "lucide-react";
import { ViewPopover } from "./view-popover";
import { useState } from "react";
import { type ListSummary } from "@wuff/contracts";
import { Button } from "../../../../button";
import { NativeSelect } from "../../../../native-select";

export function ListPersonalActions({
  list,
  lists,
  busy,
  favorite,
  move,
  compact = false,
  embedded = false,
}: {
  compact?: boolean;
  embedded?: boolean;
  list: ListSummary;
  lists: ListSummary[];
  busy: boolean;
  favorite: (id: string, enabled: boolean) => Promise<boolean>;
  move: (id: string, parent: string | null) => Promise<boolean>;
}) {
  const [parent, setParent] = useState(list.parentListId ?? "");
  const [notice, setNotice] = useState("");
  const hasChildren = lists.some(
    (item) => !item.archived && item.parentListId === list.id,
  );
  const panel = (
    <div
      className={
        compact || embedded
          ? "list-personal-menu"
          : "list-personal-actions-panel"
      }
    >
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          if (await favorite(list.id, !list.favorite))
            setNotice(
              list.favorite ? "Removed from favorites." : "Added to favorites.",
            );
        }}
      >
        <Star
          size={16}
          aria-hidden="true"
          fill={list.favorite ? "currentColor" : "none"}
        />
        {list.favorite ? "Remove from favorites" : "Add to favorites"}
      </Button>
      <details className="list-move-menu">
        <summary>
          <FolderInput size={16} aria-hidden="true" />
          Move to…
        </summary>
        <div className="list-move-fields">
          <label>
            Parent list
            <NativeSelect
              value={parent}
              disabled={busy || hasChildren}
              onChange={(e) => {
                setParent(e.target.value);
                setNotice("");
              }}
            >
              <option value="">Top level</option>
              {lists
                .filter(
                  (item) =>
                    !item.archived && item.id !== list.id && !item.parentListId,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </NativeSelect>
          </label>
          {hasChildren && (
            <p className="text-xs text-muted-foreground">
              Move this list’s children first to change its parent.
            </p>
          )}
          <Button
            disabled={
              busy || hasChildren || parent === (list.parentListId ?? "")
            }
            onClick={async () => {
              if (await move(list.id, parent || null)) setNotice("List moved.");
            }}
          >
            Move list
          </Button>
          <p className="text-xs text-muted-foreground">
            Only changes your sidebar.
          </p>
        </div>
      </details>
      {notice && (
        <p role="status" className="sr-only">
          {notice}
        </p>
      )}
    </div>
  );
  if (embedded) return panel;
  return compact ? (
    <ViewPopover
      label={<MoreHorizontal size={16} aria-hidden="true" />}
      ariaLabel={`Actions for list ${list.title}`}
      panelLabel={`Actions for list ${list.title}`}
      variant="ghost"
      className="sidebar-list-actions"
    >
      {panel}
    </ViewPopover>
  ) : (
    <details className="list-personal-actions">
      <summary>List actions</summary>
      {panel}
    </details>
  );
}
