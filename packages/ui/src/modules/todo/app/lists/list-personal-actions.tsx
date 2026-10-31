"use client";
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
}: {
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
  return (
    <details className="list-personal-actions">
      <summary>List actions</summary>
      <div className="list-personal-actions-panel">
        <p className="text-xs text-muted-foreground">
          Only changes your organization.
        </p>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            if (await favorite(list.id, !list.favorite))
              setNotice(
                list.favorite
                  ? "Removed from favorites."
                  : "Added to favorites.",
              );
          }}
        >
          {list.favorite ? "Remove from favorites" : "Add to favorites"}
        </Button>
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
          disabled={busy || hasChildren || parent === (list.parentListId ?? "")}
          onClick={async () => {
            if (await move(list.id, parent || null)) setNotice("List moved.");
          }}
        >
          Move list
        </Button>
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
      </div>
    </details>
  );
}
