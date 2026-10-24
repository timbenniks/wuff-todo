"use client";
import { ListReminders } from "../../components/reminders/list-reminders";
import { Textarea } from "../../../textarea";
import { NativeSelect } from "../../../native-select";

import { useRef, useState, type ReactNode } from "react";
import { Input } from "../../../input";
import {
  Archive,
  ArchiveRestore,
  Check,
  Settings,
  Star,
  X,
} from "lucide-react";
import {
  listColors,
  type ListColor,
  type TodoList,
  type ListSummary,
} from "@wuff/contracts";
import { Button } from "../../../button";
import { listPalette } from "../../lib/list-colors";

export type ListChange = (
  path: string,
  method: string,
  body: Record<string, unknown>,
) => Promise<boolean>;
type SidebarLocation = {
  lists: ListSummary[];
  disabled: boolean;
  error: string;
  favorite: (id: string, enabled: boolean) => Promise<boolean>;
  move: (id: string, parentId: string | null) => Promise<boolean>;
  retry?: () => Promise<boolean>;
};

function ListLocation({
  list,
  busy,
  lists,
  disabled,
  error,
  move,
  favorite,
  retry,
}: SidebarLocation & { list: TodoList; busy: boolean }) {
  const [parentId, setParentId] = useState(
    lists.find((item) => item.id === list.id)?.parentListId ?? "",
  );
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favoriteSaved, setFavoriteSaved] = useState(false);
  const isFavorite =
    lists.find((item) => item.id === list.id)?.favorite ?? false;
  const hasChildren = lists.some((item) => item.parentListId === list.id);
  const candidates = lists.filter(
    (item) =>
      item.id !== list.id &&
      !item.parentListId &&
      (item.archived === list.archived || item.id === parentId),
  );
  return (
    <section
      className="rounded-xl border border-border bg-accent p-4 mb-6"
      aria-labelledby={`sidebar-location-${list.id}`}
    >
      <h3 id={`sidebar-location-${list.id}`} className="text-sm font-bold mb-2">
        Your sidebar
      </h3>
      <Button
        type="button"
        variant="outline"
        className="mb-2"
        disabled={disabled}
        aria-pressed={isFavorite}
        onClick={async () => {
          setFailed(false);
          setSaved(false);
          setFavoriteSaved(false);
          const ok = await favorite(list.id, !isFavorite);
          setFailed(!ok);
          setFavoriteSaved(ok);
        }}
      >
        <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
        {isFavorite ? "Remove from favorites" : "Add to favorites"}
      </Button>
      <p className="text-sm text-muted-foreground mb-4">
        Favorites give you quick access above your list pack. Only you see your
        favorites.
      </p>
      {favoriteSaved && (
        <p role="status" className="text-sm text-muted-foreground mb-4">
          {isFavorite
            ? "Added to your favorites."
            : "Removed from your favorites."}
        </p>
      )}
      <p className="text-sm text-muted-foreground mb-4">
        Move this list under another list, or keep it at top level. Only your
        sidebar changes; tasks, subtasks and sharing stay with the list.
      </p>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (disabled) return;
          setFailed(false);
          setSaved(false);
          const ok = await move(list.id, parentId || null);
          setSaved(ok);
          setFailed(!ok);
        }}
      >
        <label
          htmlFor={`sidebar-parent-${list.id}`}
          className="text-sm font-semibold"
        >
          Parent list
        </label>
        <NativeSelect
          id={`sidebar-parent-${list.id}`}
          value={parentId}
          disabled={disabled || hasChildren}
          onChange={(e) => {
            setParentId(e.target.value);
            setSaved(false);
          }}
        >
          <option value="">Top level</option>
          {candidates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {item.archived && " (archived)"}
            </option>
          ))}
        </NativeSelect>
        {hasChildren && (
          <p className="text-sm text-muted-foreground">
            This list has child lists. Move those first to keep one level of
            nesting.
          </p>
        )}
        {(failed || retry) && (
          <p role="alert" className="text-sm text-red-800">
            {error || "Your sidebar change wasn’t saved. Try again."}
          </p>
        )}
        {retry && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const ok = await retry();
              setSaved(ok);
              setFavoriteSaved(false);
              setFailed(!ok);
            }}
          >
            Retry sidebar change
          </Button>
        )}
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Your sidebar changes are saved.
          </p>
        )}
        <Button variant="outline" disabled={disabled || hasChildren}>
          {busy ? "Moving…" : "Move list"}
        </Button>
      </form>
    </section>
  );
}

export function ListSettings({
  list,
  userId,
  busy,
  change,
  retry,
  sidebar,
  actions,
}: {
  list: TodoList;
  userId: string;
  busy: boolean;
  change: ListChange;
  retry?: () => Promise<boolean>;
  sidebar?: SidebarLocation;
  actions?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState({
    title: list.title,
    description: list.description,
    color: list.color,
    mode: list.mode,
    version: list.version,
  });
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState(0);
  function load() {
    setOpened((count) => count + 1);
    setDraft({
      title: list.title,
      description: list.description,
      color: list.color,
      mode: list.mode,
      version: list.version,
    });
    setFailed(false);
  }
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="List settings"
        title="List settings"
        disabled={busy}
        onClick={() => {
          load();
          dialog.current?.showModal();
        }}
      >
        <Settings size={20} aria-hidden="true" />
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`settings-${list.id}`}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-surface text-foreground p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <div className="flex justify-between items-start gap-3 mb-5">
          <div>
            <h2 id={`settings-${list.id}`} className="text-2xl font-bold">
              List settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              List details and your personal preferences.
            </p>
          </div>
          <Button
            aria-label="Close list settings"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4 break-words">
          {list.title} ·{" "}
          {list.ownerId === userId
            ? "Your list · Pack leader"
            : "Shared with your pack"}
          {list.mode === "work" && " · Work"}
        </p>
        {list.ownerId !== userId && list.description && (
          <p className="whitespace-pre-wrap break-words text-sm mb-4">
            {list.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mb-5">{actions}</div>
        {list.ownerId === userId && (
          <>
            <form
              className="grid gap-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setFailed(false);
                const ok = await change(`/api/v1/lists/${list.id}`, "PATCH", {
                  listId: list.id,
                  ...draft,
                });
                if (ok) dialog.current?.close();
                else setFailed(true);
              }}
            >
              <label className="grid gap-2 text-sm font-semibold">
                List name
                <Input
                  value={draft.title}
                  required
                  maxLength={300}
                  readOnly={busy}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                List type
                <NativeSelect
                  aria-label="List type"
                  value={draft.mode}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      mode: e.target.value as TodoList["mode"],
                    })
                  }
                >
                  <option value="simple">Simple</option>
                  <option value="work">Work</option>
                </NativeSelect>
                <span className="text-xs font-normal text-muted-foreground">
                  Work adds workflow, priority and links. Share the list to
                  assign tasks.
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Description
                <Textarea
                  rows={4}
                  maxLength={4000}
                  placeholder="What’s the plan for your pack?"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
                <span className="font-normal text-xs text-muted-foreground">
                  A few de-tails for your pack. Plain text, up to 4,000
                  characters.
                </span>
              </label>
              <fieldset>
                <legend className="text-sm font-semibold mb-3">
                  List color
                </legend>
                <p className="text-xs text-muted-foreground mb-3">
                  This color themes the app while you’re in this list, including
                  backgrounds, text and controls.
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {listColors.map((color) => {
                    const p = listPalette[color];
                    return (
                      <label
                        key={color}
                        className="relative cursor-pointer text-center text-xs grid justify-items-center gap-2 rounded-xl p-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                        style={{
                          background:
                            draft.color === color ? p.tint : undefined,
                        }}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="color"
                          value={color}
                          checked={draft.color === color}
                          onChange={() =>
                            setDraft({ ...draft, color: color as ListColor })
                          }
                        />
                        <span
                          className="rounded-full w-8 h-8 flex items-center justify-center text-white"
                          style={{ background: p.accent }}
                        >
                          {draft.color === color && <Check size={17} />}
                        </span>
                        {p.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {list.version !== draft.version && (
                <div
                  role="status"
                  className="text-sm rounded-xl bg-amber-50 p-3"
                >
                  <p>
                    New de-tails arrived while you were editing. Your draft is
                    still here.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={load}
                  >
                    Load latest settings
                  </Button>
                </div>
              )}
              {failed && (
                <p role="alert" className="text-sm text-red-800">
                  Ruff patch! Settings weren’t saved. Check the list’s error
                  message or load its latest settings, then try again.
                </p>
              )}
              {retry && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    if (await retry()) dialog.current?.close();
                  }}
                >
                  Retry same request
                </Button>
              )}
              <Button
                disabled={busy}
                type="submit"
                variant="primary"
                aria-label={busy ? "Saving settings" : "Save settings"}
                title="Save settings"
              >
                <Check size={18} aria-hidden="true" />{" "}
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </form>
            <div className="border-t border-border mt-6 pt-5">
              <p className="text-sm text-muted-foreground mb-3">
                {list.archived
                  ? "Paws over? Restore this list so everyone can edit its tasks again."
                  : "Let this list take a paws for everyone. Its tasks and sharing are kept."}
              </p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  const ok = await change(`/api/v1/lists/${list.id}`, "PATCH", {
                    listId: list.id,
                    version: list.version,
                    archived: !list.archived,
                  });
                  if (ok) dialog.current?.close();
                }}
              >
                {list.archived ? (
                  <ArchiveRestore size={16} />
                ) : (
                  <Archive size={16} />
                )}{" "}
                {list.archived ? "Restore list" : "Archive list"}
              </Button>
            </div>
          </>
        )}
        <div className="mt-6">
          {sidebar && (
            <ListLocation
              key={`${list.id}:${opened}`}
              list={list}
              busy={busy}
              {...sidebar}
            />
          )}
        </div>
        <ListReminders key={list.id} listId={list.id} userId={userId} />
      </dialog>
    </>
  );
}
