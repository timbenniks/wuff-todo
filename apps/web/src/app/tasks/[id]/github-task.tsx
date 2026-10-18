"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GithubTaskState, Task, TodoList } from "@wuff/contracts";
export function GithubTask({
  task,
  list,
  userId,
  refresh,
}: {
  task: Task;
  list: TodoList;
  userId: string;
  refresh: () => Promise<void>;
}) {
  const [link, setLink] = useState<
      (GithubTaskState & { active: boolean }) | null
    >(null),
    [number, setNumber] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [prs, setPrs] = useState<{ title: string; url: string; state: string }[]>(
      [],
    );
  const pending = useRef<Record<string, unknown> | null>(null);
  async function load() {
    setLink(
      (
        await api<{ link: any }>(
          `/api/v1/github?taskId=${task.id}`,
          "GET",
          undefined,
          userId,
        )
      ).link,
    );
  }
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (active && !pending.current) load().catch((e) => setError(e.message));
    };
    tick();
    const timer = setInterval(tick, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [task.id, list.version]);
  async function action(
    kind: string,
    extra: Record<string, unknown> = {},
    retry = false,
  ) {
    if (pending.current && !retry) {
      setError("Retry the previous request first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = retry
        ? pending.current!
        : {
            action: kind,
            listId: list.id,
            taskId: task.id,
            version: list.version,
            operationId: crypto.randomUUID(),
            ...extra,
          };
      pending.current = body;
      await api("/api/v1/github", "POST", body, userId);
      pending.current = null;
      await load();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  if (list.mode !== "work") return null;
  return (
    <section
      id="github"
      className="rounded-xl border border-border bg-surface p-4 sm:p-5 grid gap-3 min-w-0 scroll-mt-4"
    >
      <h2 className="text-lg font-bold">GitHub issue</h2>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {pending.current && (
        <Button disabled={busy} onClick={() => action("", {}, true)}>
          Retry previous request
        </Button>
      )}
      {link ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-tag" role="status">
              {link.active ? link.state : "Disconnected"}
            </span>
            {link.url && (
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline break-all"
              >
                Issue #{link.issueNumber}
              </a>
            )}
          </div>
          {link.error && (
            <p className="text-sm">
              {link.error === "github_create_uncertain"
                ? "GitHub may have created the issue. Reconcile to find it before creating another."
                : link.error === "github_unsupported_content"
                  ? "Notes contain unsupported content or private attachments. Keep those private and resolve the note format before syncing."
                  : "Sync needs attention. Check GitHub access, then reconcile."}
            </p>
          )}
          {link.conflict && (
            <>
              <p>
                Both sides changed. Compare before choosing which version to
                keep.
              </p>
              {(["wuff", "github"] as const).map((side) => (
                <div
                  key={side}
                  className="border border-border rounded-lg p-3 min-w-0"
                >
                  <h3 className="font-semibold">
                    {side === "wuff" ? "Wuff" : "GitHub"}
                  </h3>
                  <p className="break-words">{link.conflict![side].title}</p>
                  <pre className="whitespace-pre-wrap break-words text-sm max-h-40 overflow-auto">
                    {link.conflict![side].body}
                  </pre>
                  <p className="text-sm">
                    {link.conflict![side].closed ? "Done" : "Open"}
                  </p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || list.archived}
                  onClick={() =>
                    action("resolve", {
                      revision: link.revision,
                      choice: "wuff",
                    })
                  }
                >
                  Keep Wuff
                </Button>
                <Button
                  disabled={busy || list.archived}
                  onClick={() =>
                    action("resolve", {
                      revision: link.revision,
                      choice: "github",
                    })
                  }
                >
                  Keep GitHub
                </Button>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || list.archived}
              onClick={() => action("retry")}
            >
              Reconcile now
            </Button>
            {userId === list.ownerId && (
              <Button
                disabled={busy || list.archived}
                onClick={() => action("unlink")}
              >
                Unlink issue
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={async () => {
                try {
                  setPrs(
                    (
                      await api<{ pullRequests: typeof prs }>(
                        `/api/v1/github?pullRequests=${task.id}`,
                        "GET",
                        undefined,
                        userId,
                      )
                    ).pullRequests,
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Load related pull requests
            </Button>
          </div>
          {prs.map((p) => (
            <a
              key={p.url}
              href={p.url}
              className="text-primary underline break-words"
            >
              {p.title} · {p.state}
            </a>
          ))}
          <p className="text-sm text-muted-foreground">
            Unlinking keeps both the task and issue. Merge events do not
            automatically finish tasks.
          </p>
        </>
      ) : (
        <>
          {userId === list.ownerId ? (
            <>
              <a
                className="text-primary underline"
                href={`/github?listId=${list.id}`}
              >
                Connect this list’s repository
              </a>
              <label className="grid gap-1 text-sm">
                Existing issue number
                <Input
                  inputMode="numeric"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || list.archived || !/^\d+$/.test(number)}
                  onClick={() =>
                    action("link", { issueNumber: Number(number) })
                  }
                >
                  Link existing issue
                </Button>
                <Button
                  variant="primary"
                  disabled={busy || list.archived}
                  onClick={() => action("link")}
                >
                  Create GitHub issue
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                This shares the task title and supported notes with the
                connected repository. Private attachments are not exported.
              </p>
            </>
          ) : (
            <p>The list owner can link a GitHub issue.</p>
          )}
        </>
      )}
    </section>
  );
}
