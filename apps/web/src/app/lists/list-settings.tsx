"use client";
import { useRef, useState } from "react";
import { Archive, ArchiveRestore, Check, Settings2, X } from "lucide-react";
import { listColors, type ListColor, type TodoList } from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { listPalette } from "@/lib/list-colors";

export type ListChange = (
  path: string,
  method: string,
  body: Record<string, unknown>,
) => Promise<boolean>;
export function ListSettings({
  list,
  busy,
  change,
  retry,
}: {
  list: TodoList;
  busy: boolean;
  change: ListChange;
  retry?: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState({
    title: list.title,
    description: list.description,
    color: list.color,
    version: list.version,
  });
  const [failed, setFailed] = useState(false);
  function load() {
    setDraft({
      title: list.title,
      description: list.description,
      color: list.color,
      version: list.version,
    });
    setFailed(false);
  }
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          load();
          dialog.current?.showModal();
        }}
      >
        <Settings2 size={16} />
        List settings
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`settings-${list.id}`}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-white text-foreground p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <div className="flex justify-between items-start gap-3 mb-5">
          <div>
            <h2 id={`settings-${list.id}`} className="text-2xl font-bold">
              List settings
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              These settings are shared with everyone on this list.
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
            <input
              required
              maxLength={300}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Description
            <textarea
              rows={4}
              maxLength={4000}
              placeholder="What is this list for?"
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
            <span className="font-normal text-xs text-slate-500">
              A little context for everyone. Plain text, up to 4,000 characters.
            </span>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold mb-3">List color</legend>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {listColors.map((color) => {
                const p = listPalette[color];
                return (
                  <label
                    key={color}
                    className="relative cursor-pointer text-center text-xs grid justify-items-center gap-2 rounded-xl p-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                    style={{
                      background: draft.color === color ? p.tint : undefined,
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
            <div role="status" className="text-sm rounded-xl bg-amber-50 p-3">
              <p>
                This list changed while you were editing. Your draft is still
                here.
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={load}>
                Load latest settings
              </Button>
            </div>
          )}
          {failed && (
            <p role="alert" className="text-sm text-red-800">
              Settings weren’t saved. Check the list’s error message or load its
              latest settings, then try again.
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
          <Button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </form>
        <div className="border-t border-border mt-6 pt-5">
          <p className="text-sm text-slate-500 mb-3">
            {list.archived
              ? "Restore this list so everyone can edit its tasks again."
              : "Put this list away for everyone. Its tasks and sharing are kept."}
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
      </dialog>
    </>
  );
}
