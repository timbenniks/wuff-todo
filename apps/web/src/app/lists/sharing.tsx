"use client";
import { wuffCopy, wuffError } from "@/lib/copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { Users, X } from "lucide-react";
import type {
  IncomingInvitation,
  ListSharing,
  TodoList,
} from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

import { useActorApi } from "./actor-api";

type Request = { path: string; method: string; body: Record<string, unknown> };
// An uncertain response retains the exact operation ID and payload for retry.
function useSharingMutation<T>(saved: (value: T) => Promise<void>) {
  const api = useActorApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<Request | null>(null);
  const pending = useRef(false);
  async function run(request: Request) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await api<T>(request.path, request.method, request.body);
      setRetry(null);
      await saved(value);
      return true;
    } catch (e) {
      setError(
        wuffError(
          e instanceof Error ? e.message : "Couldn’t save sharing settings.",
        ),
      );
      setRetry(e instanceof ApiError && e.status < 500 ? null : request);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, error, retry, run, pending };
}
function MutationError({
  mutation,
}: {
  mutation: ReturnType<typeof useSharingMutation>;
}) {
  return mutation.error ? (
    <div role="alert" className="rounded-xl bg-red-50 text-red-800 p-3 text-sm">
      <p>{mutation.error}</p>
      {mutation.retry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={mutation.busy}
          onClick={() => mutation.run(mutation.retry!)}
        >
          Retry same request
        </Button>
      )}
    </div>
  ) : null;
}
export function InvitationInbox({
  initial,
  onJoined,
}: {
  initial: IncomingInvitation[];
  onJoined: (id: string) => Promise<void>;
}) {
  const api = useActorApi();
  const [items, setItems] = useState(initial);
  const [readError, setReadError] = useState("");
  const revision = useRef(0);
  const mutation = useSharingMutation<{ listId: string; accepted: boolean }>(
    async (value) => {
      revision.current++;
      // Refreshing the inbox also reconciles a lost acceptance response.
      const next = await api<IncomingInvitation[]>("/api/v1/invitations");
      setItems(next);
      if (value.accepted) await onJoined(value.listId);
    },
  );
  useEffect(() => {
    let active = true,
      refreshing = false;
    const refresh = async () => {
      if (document.hidden || refreshing || mutation.pending.current) return;
      refreshing = true;
      const epoch = revision.current;
      try {
        const next = await api<IncomingInvitation[]>("/api/v1/invitations");
        if (active && revision.current === epoch && !mutation.pending.current) {
          setItems(next);
          setReadError("");
        }
      } catch (e) {
        if (active) {
          if (e instanceof ApiError && [401, 403].includes(e.status))
            setItems([]);
          setReadError(
            "We lost the scent of your invitations. We’ll check again shortly.",
          );
        }
      } finally {
        refreshing = false;
      }
    };
    const timer = setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [mutation.pending, api]);
  return (
    <>
      {(items.length > 0 || mutation.error) && (
        <section
          aria-label="List invitations"
          className="rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-8 grid gap-4"
        >
          <h2 className="font-semibold">Your pack is calling</h2>
          {items.map((invite) => (
            <div key={invite.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold break-words">{invite.listTitle}</p>
                <p className="text-sm text-slate-600 break-words">
                  A pack invite from {invite.ownerName} · {invite.ownerEmail}
                </p>
              </div>
              <Button
                size="sm"
                disabled={mutation.busy || !!mutation.retry}
                aria-label={`Accept invitation to ${invite.listTitle}`}
                onClick={() =>
                  mutation.run({
                    path: `/api/v1/invitations/${invite.id}`,
                    method: "POST",
                    body: { accept: true, operationId: crypto.randomUUID() },
                  })
                }
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={mutation.busy || !!mutation.retry}
                aria-label={`Decline invitation to ${invite.listTitle}`}
                onClick={() =>
                  mutation.run({
                    path: `/api/v1/invitations/${invite.id}`,
                    method: "POST",
                    body: { accept: false, operationId: crypto.randomUUID() },
                  })
                }
              >
                Decline
              </Button>
            </div>
          ))}
          {mutation.busy && (
            <p role="status" className="text-sm text-slate-500">
              {wuffCopy.savingInvitation}
            </p>
          )}
          <MutationError mutation={mutation} />
        </section>
      )}
      {readError && (
        <p role="status" className="text-sm text-slate-500 mb-4">
          {readError}
        </p>
      )}
    </>
  );
}
export function SharingDialog({
  list,
  userId,
  disabled,
  onChanged,
}: {
  list: TodoList;
  userId: string;
  disabled: boolean;
  onChanged: (id: string, left?: boolean) => Promise<void>;
}) {
  const api = useActorApi();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState<ListSharing | null>(null);
  const [readError, setReadError] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const revision = useRef(0);
  const owner = list.ownerId === userId;
  const mutation = useSharingMutation<
    ListSharing | { listId: string; left: boolean }
  >(async (value) => {
    revision.current++;
    if ("left" in value) {
      dialog.current?.close();
      await onChanged(list.id, true);
    } else {
      setSharing(value);
      setNotice(wuffCopy.sharingSaved);
      await onChanged(list.id);
    }
  });
  const refresh = useCallback(async () => {
    const epoch = ++revision.current;
    try {
      const value = await api<ListSharing>(`/api/v1/lists/${list.id}/sharing`);
      if (revision.current === epoch) {
        setSharing(value);
        setReadError("");
      }
    } catch (e) {
      if (revision.current === epoch) {
        setReadError(
          wuffError(
            e instanceof Error ? e.message : "Couldn’t load sharing settings.",
          ),
        );
        if (e instanceof ApiError && [401, 403, 404].includes(e.status))
          setSharing(null);
      }
    }
  }, [list.id, api]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    void refresh();
    const update = () => {
      if (!document.hidden && !mutation.pending.current) void refresh();
    };
    const timer = setInterval(update, 10_000);
    window.addEventListener("focus", update);
    return () => {
      revision.current++;
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [open, refresh, mutation.pending]);
  async function change(
    path: string,
    method: string,
    body: Record<string, unknown>,
  ) {
    if (!sharing) return false;
    revision.current++;
    setNotice("");
    const ok = await mutation.run({
      path,
      method,
      body: {
        ...body,
        version: sharing.version,
        operationId: crypto.randomUUID(),
      },
    });
    if (!ok) await refresh();
    return ok;
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Users size={16} />
        {owner ? "Share" : "People"}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={`sharing-title-${list.id}`}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-white text-foreground p-6 shadow-xl backdrop:bg-slate-900/30"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <h2 id={`sharing-title-${list.id}`} className="text-2xl font-bold">
              Share with your pack
            </h2>
            <p className="text-sm text-slate-500 break-words mt-1">
              {list.title}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close sharing"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="grid gap-5">
          {readError && (
            <div role="alert">
              <p className="text-sm text-red-800">{readError}</p>
              <Button size="sm" variant="outline" onClick={refresh}>
                Refresh sharing
              </Button>
            </div>
          )}
          {!sharing && !readError && <p role="status">Fetching your pack…</p>}
          {sharing && (
            <>
              <section aria-label="People with access" className="grid gap-3">
                <Person
                  name={sharing.owner.name}
                  email={sharing.owner.email}
                  role="Owner"
                />
                {sharing.members.map((person) => (
                  <div key={person.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Person
                        name={person.name}
                        email={person.email}
                        role="Editor"
                      />
                    </div>
                    {owner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${person.name}`}
                        disabled={mutation.busy || !!mutation.retry}
                        onClick={() =>
                          change(
                            `/api/v1/lists/${list.id}/members/${encodeURIComponent(person.id)}`,
                            "DELETE",
                            {},
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </section>
              <p className="text-sm text-slate-500">
                Pack rules: editors can change tasks. Only the owner can rename,
                delete, or share the list.
              </p>
              {owner ? (
                <>
                  <form
                    className="grid gap-2 border-t border-border pt-5"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await change(
                          `/api/v1/lists/${list.id}/invitations`,
                          "POST",
                          { email },
                        )
                      )
                        setEmail("");
                    }}
                  >
                    <label
                      htmlFor={`invite-${list.id}`}
                      className="text-sm font-semibold"
                    >
                      Invite someone to your pack
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id={`invite-${list.id}`}
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Their Wuff account email"
                        required
                        maxLength={254}
                        className="min-w-0 flex-1 basis-48"
                      />
                      <Button disabled={mutation.busy || !!mutation.retry}>
                        Invite
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Roll out the wag-on: they’ll see an invitation in Wuff.
                      They need an existing account. No email is sent.
                    </p>
                  </form>
                  {sharing.invitations.length > 0 && (
                    <section
                      aria-label="Pending invitations"
                      className="grid gap-3"
                    >
                      <h3 className="text-sm font-semibold">
                        Awaiting a tail wag · Pending invitations
                      </h3>
                      {sharing.invitations.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm break-words">
                              {invite.email}
                            </p>
                            <p className="text-xs text-slate-500">
                              Expires{" "}
                              {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={mutation.busy || !!mutation.retry}
                            aria-label={`Cancel invitation to ${invite.email}`}
                            onClick={() =>
                              change(
                                `/api/v1/lists/${list.id}/invitations/${invite.id}`,
                                "DELETE",
                                {},
                              )
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              ) : (
                <Button
                  variant="outline"
                  disabled={mutation.busy || !!mutation.retry}
                  onClick={() =>
                    change(`/api/v1/lists/${list.id}/leave`, "POST", {})
                  }
                >
                  Leave list
                </Button>
              )}
            </>
          )}
          {mutation.busy && (
            <p role="status" className="text-sm text-slate-500">
              {wuffCopy.savingSharing}
            </p>
          )}
          <MutationError mutation={mutation} />
          {notice && (
            <p role="status" className="text-sm text-slate-500">
              {notice}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
function Person({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold break-words">
        {name} <span className="font-normal text-slate-500">· {role}</span>
      </p>
      <p className="text-xs text-slate-500 break-words">{email}</p>
    </div>
  );
}
