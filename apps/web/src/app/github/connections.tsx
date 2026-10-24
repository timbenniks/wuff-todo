"use client";
import { useEffect, useState, useRef } from "react";
import { api as rawApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { ListSummary, TodoList } from "@wuff/contracts";
type Repository = {
  installationId: number;
  repositoryId: number;
  name: string;
  private: boolean;
};
export function GithubConnections({
  lists,
  initialId,
  userId,
}: {
  lists: ListSummary[];
  initialId?: string;
  userId: string;
}) {
  const api = <T,>(path: string, method = "GET", body?: unknown) =>
    rawApi<T>(path, method, body, userId);
  const [info, setInfo] = useState<{
      configured: boolean;
      account: string | null;
      installUrl: string;
      bindings?: {
        listId: string;
        repository: string;
        active: boolean;
        autoCreateIssues: boolean;
      }[];
    } | null>(null),
    [repos, setRepos] = useState<Repository[]>([]),
    [listId, setListId] = useState(
      lists.some((l) => l.id === initialId) ? initialId! : (lists[0]?.id ?? ""),
    ),
    [list, setList] = useState<TodoList | null>(null),
    [repo, setRepo] = useState(""),
    [consent, setConsent] = useState(false),
    [autoCreateIssues, setAutoCreateIssues] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef<Record<string, unknown> | null>(null);
  const readEpoch = useRef(0);
  const [loading, setLoading] = useState(true);
  const [reposLoaded, setReposLoaded] = useState(false);
  const locked = busy || !!pending.current;
  const binding = info?.bindings?.find((b) => b.listId === listId);
  useEffect(() => {
    setAutoCreateIssues(
      info?.bindings?.find((b) => b.listId === listId)?.autoCreateIssues ??
        false,
    );
  }, [info, listId]);
  async function refresh() {
    const epoch = ++readEpoch.current;
    setLoading(true);
    setError("");
    setList(null);
    try {
      const [nextInfo, nextList] = await Promise.all([
        api<NonNullable<typeof info>>("/api/v1/github"),
        listId
          ? api<TodoList>(`/api/v1/lists/${listId}`)
          : Promise.resolve(null),
      ]);
      if (epoch === readEpoch.current) {
        setInfo(nextInfo);
        setList(nextList);
      }
    } catch (e) {
      if (epoch === readEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === readEpoch.current) setLoading(false);
    }
  }
  useEffect(() => {
    setConsent(false);
    setRepo("");
    void refresh();
    return () => {
      readEpoch.current++;
    };
  }, [listId]);
  async function action(body: Record<string, unknown>, retry = false) {
    if (pending.current && !retry) {
      setError("Retry the previous request before making another change.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const request = retry
        ? pending.current!
        : { ...body, operationId: crypto.randomUUID() };
      pending.current = request;
      const result = await api<any>("/api/v1/github", "POST", request);
      pending.current = null;
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setNotice("GitHub connection updated.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        void refresh().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {error && !pending.current && (
        <Button
          variant="outline"
          disabled={locked}
          onClick={() => void refresh()}
        >
          Retry GitHub status
        </Button>
      )}
      {notice && <p role="status">{notice}</p>}
      {pending.current && (
        <Button disabled={busy} onClick={() => action({}, true)}>
          Retry previous request
        </Button>
      )}
      {!info ? (
        !error && <p role="status">Loading GitHub connection…</p>
      ) : !info.configured ? (
        <p>GitHub setup is not available yet.</p>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-4 grid gap-3">
            <h2 className="text-lg font-bold">Your GitHub account</h2>
            <p>
              {info.account
                ? `Connected as ${info.account}`
                : "Verify your GitHub identity before choosing a repository."}
            </p>
            <Button
              disabled={locked}
              onClick={() => action({ action: "connect" })}
            >
              {info.account ? "Reconnect GitHub" : "Connect GitHub"}
            </Button>
            {info.account && (
              <>
                <a className="text-primary underline" href={info.installUrl}>
                  Install or manage the Wuff GitHub App
                </a>
                <Button
                  disabled={locked}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      setReposLoaded(true);
                      setRepos(
                        (
                          await api<{ repositories: Repository[] }>(
                            "/api/v1/github?repositories=1",
                          )
                        ).repositories,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Load installed repositories
                </Button>
              </>
            )}
          </section>
          {!info.account && (
            <p>
              Connect your account first. Then choose a Work list, load a
              repository and review what will be shared.
            </p>
          )}
          {info.account && (
            <section className="rounded-xl border border-border bg-surface p-4 grid gap-3">
              <h2 className="text-lg font-bold">Repository for your list</h2>
              {loading && <p role="status">Loading selected list…</p>}
              {!lists.length && (
                <p>Create a Work list before connecting a repository.</p>
              )}
              {reposLoaded && !repos.length && (
                <p>
                  No installed repositories found. Manage the GitHub App’s
                  repository access, then load again.
                </p>
              )}
              {info.bindings
                ?.filter((b) => b.listId === listId)
                .map((b) => (
                  <p key={b.listId} className="text-sm">
                    {b.repository} · {b.active ? "Connected" : "Stopped"}
                    {b.autoCreateIssues
                      ? " · New tasks create issues automatically"
                      : " · Manual issue linking"}
                  </p>
                ))}
              <label className="grid gap-1 text-sm">
                Your list
                <NativeSelect
                  value={listId}
                  disabled={locked}
                  onChange={(e) => {
                    setListId(e.target.value);
                    setConsent(false);
                  }}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              {list && list.mode !== "work" && (
                <p>
                  Choose Work in this list’s settings before connecting a
                  repository.
                </p>
              )}
              <label className="grid gap-1 text-sm">
                Installed repository
                <NativeSelect
                  value={repo}
                  disabled={locked || loading}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    setConsent(false);
                    setAutoCreateIssues(false);
                  }}
                >
                  <option value="">Choose a repository</option>
                  {repos.map((r) => (
                    <option key={r.repositoryId} value={r.repositoryId}>
                      {r.name}
                      {r.private ? " · Private" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={locked || loading || !repo}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1"
                />
                I allow this list’s current and future members to see
                synchronized issue titles and notes, including private
                repository content.
              </label>
              <fieldset
                className="grid gap-2 border-t border-border pt-3"
                disabled={locked || !consent || !repo}
              >
                <legend className="text-sm font-semibold">
                  Optional issue automation
                </legend>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={autoCreateIssues}
                    disabled={locked}
                    onChange={(e) => setAutoCreateIssues(e.target.checked)}
                    className="mt-1"
                  />
                  Automatically create a GitHub issue for each new top-level
                  task. Titles, supported notes and completion sync both ways.
                  Existing tasks and subtasks are not added automatically.
                </label>
              </fieldset>
              {repo && (
                <p className="text-sm">
                  Destination:{" "}
                  {repos.find((r) => String(r.repositoryId) === repo)?.name} ·{" "}
                  {list?.title}. Only linked issue titles, supported notes and
                  completion synchronize. Private attachments and assignees stay
                  separate.
                </p>
              )}
              <Button
                variant="primary"
                disabled={
                  locked ||
                  loading ||
                  !consent ||
                  !repo ||
                  list?.id !== listId ||
                  list?.mode !== "work"
                }
                onClick={() => {
                  const selected = repos.find(
                    (r) => String(r.repositoryId) === repo,
                  );
                  if (selected && list)
                    void action({
                      action: "bind",
                      listId,
                      version: list.version,
                      ...selected,
                      shareWithList: true,
                      autoCreateIssues,
                    });
                }}
              >
                Save repository connection
              </Button>
              {list && binding?.active && (
                <Button
                  variant="danger"
                  disabled={locked}
                  onClick={() =>
                    action({
                      action: "disconnect",
                      listId,
                      version: list.version,
                    })
                  }
                >
                  Stop repository synchronization
                </Button>
              )}
              <p className="text-sm text-muted-foreground">
                Stopping sync keeps the existing tasks and copied notes. Unlink
                tasks before changing repositories. GitHub assignees and private
                attachments are not synchronized.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
