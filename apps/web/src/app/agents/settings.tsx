"use client";
import { useEffect, useRef, useState } from "react";
import type { ListSummary } from "@wuff/contracts";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Readiness = {
  ready: boolean;
  missingSecrets: string[];
  binding: null | {
    environmentId: string;
    environmentName: string;
    requiredSecrets: string[];
  };
};
export function AgentSettings({
  lists,
  userId,
  initialId,
}: {
  lists: ListSummary[];
  userId: string;
  initialId?: string;
}) {
  const [listId, setListId] = useState(
    lists.some((l) => l.id === initialId) ? initialId! : (lists[0]?.id ?? ""),
  );
  const [apiKey, setApiKey] = useState("");
  const [connection, setConnection] = useState<{
    connected: boolean;
    configured: boolean;
  } | null>(null);
  const [environments, setEnvironments] = useState<
      { id: string; name: string }[]
    >([]),
    [environmentId, setEnvironmentId] = useState("");
  const [required, setRequired] = useState(""),
    [secretName, setSecretName] = useState(""),
    [secretValue, setSecretValue] = useState("");
  const [environmentName, setEnvironmentName] = useState("Development"),
    [install, setInstall] = useState("pnpm install --frozen-lockfile");
  const [readiness, setReadiness] = useState<Readiness | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  async function load() {
    const c = await api<{
      connected: boolean;
      configured: boolean;
    }>("/api/v1/agents", "GET", undefined, userId);
    setConnection(c);
    if (c.connected && listId) {
      const r = await api<Readiness>(
        `/api/v1/agents?listId=${listId}`,
        "GET",
        undefined,
        userId,
      );
      setReadiness(r);
      const e = await api<{ environments: typeof environments }>(
        `/api/v1/agents?environments=1&listId=${listId}`,
        "GET",
        undefined,
        userId,
      );
      setEnvironments(e.environments);
      if (r.binding) {
        setEnvironmentId(r.binding.environmentId);
        setRequired(r.binding.requiredSecrets.join(", "));
      }
    }
  }
  useEffect(() => {
    setReadiness(null);
    setEnvironments([]);
    setEnvironmentId("");
    setRequired("");
    load().catch((e) => setError(e.message));
  }, [listId]);
  async function act(
    action: string,
    extra: Record<string, unknown>,
    retry = false,
  ) {
    if (pending.current && !retry) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let body: Record<string, unknown>;
      if (retry) body = pending.current!;
      else {
        let version = 0;
        if (listId && !["connect", "secret"].includes(action))
          version = (
            await api<{ version: number }>(
              `/api/v1/lists/${listId}`,
              "GET",
              undefined,
              userId,
            )
          ).version;
        body = {
          action,
          listId,
          version,
          operationId: crypto.randomUUID(),
          ...extra,
        };
      }
      // Credential values remain only in transient form/request memory.
      if (!["connect", "secret"].includes(action)) pending.current = body;
      await api("/api/v1/agents", "POST", body, userId);
      pending.current = null;
      setApiKey("");
      setSecretValue("");
      setNotice("Saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status < 500) pending.current = null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {connection && !connection.configured && (
        <p>
          Cursor connections are not available yet. An administrator needs to
          finish setup.
        </p>
      )}
      {pending.current && (
        <Button disabled={busy} onClick={() => act("", {}, true)}>
          Retry previous request
        </Button>
      )}
      {connection?.connected && (
        <p>Your personal Cursor account is connected.</p>
      )}
      {connection && !connection.connected && connection.configured && (
        <section className="grid gap-3 rounded-xl border border-border p-4">
          <h3 className="font-bold">Connect your Cursor account</h3>
          <p className="text-sm text-muted-foreground">
            Runs use your own Cursor account and usage allowance. Your key is
            encrypted before storage and is never shared with list members.
          </p>
          <a
            href="https://cursor.com/dashboard/api"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Create a Cursor API key
          </a>
          <label className="grid gap-1 text-sm">
            Your Cursor API key
            <Input
              type="password"
              autoComplete="off"
              maxLength={4096}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || !apiKey}
            onClick={() => act("connect", { apiKey })}
          >
            Connect personal Cursor account
          </Button>
        </section>
      )}
      <label className="grid gap-1 text-sm">
        Work list
        <select
          className="rounded-lg border border-border bg-background p-2"
          value={listId}
          onChange={(e) => {
            setError("");
            setListId(e.target.value);
          }}
        >
          <option value="">Choose a list</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </label>
      {listId && (
        <a href={`/github?listId=${listId}`} className="text-primary underline">
          Configure this list’s GitHub repository
        </a>
      )}
      {connection?.connected && listId && (
        <>
          <section className="grid gap-3 rounded-xl border border-border p-4">
            <h2 className="font-bold">Environment</h2>
            <label className="grid gap-1 text-sm">
              Existing environment
              <select
                className="rounded-lg border border-border bg-background p-2"
                value={environmentId}
                onChange={(e) => setEnvironmentId(e.target.value)}
              >
                <option value="">Choose an environment</option>
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Required secret names, separated by commas
              <Input
                value={required}
                onChange={(e) => setRequired(e.target.value)}
                placeholder="DATABASE_URL, TEST_API_KEY"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Saving allows this list’s current and future members to read agent
              instructions and final replies. Only you can launch paid work or
              view live activity.
            </p>
            <Button
              disabled={busy || !environmentId}
              onClick={() =>
                act("bind", {
                  environmentId,
                  requiredSecrets: required
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  shareWithList: true,
                })
              }
            >
              Save environment and sharing
            </Button>
            <details>
              <summary className="cursor-pointer">
                Create an environment
              </summary>
              <div className="grid gap-3 mt-3">
                <label className="grid gap-1 text-sm">
                  Name
                  <Input
                    value={environmentName}
                    onChange={(e) => setEnvironmentName(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Install command
                  <Input
                    value={install}
                    onChange={(e) => setInstall(e.target.value)}
                  />
                </label>
                <p className="text-sm">
                  Commands must not contain credentials. Environment setup may
                  consume Cursor usage.
                </p>
                <Button
                  disabled={busy || !environmentName}
                  onClick={() =>
                    act("createEnvironment", {
                      name: environmentName,
                      install,
                      start: "",
                    })
                  }
                >
                  Create in Cursor
                </Button>
              </div>
            </details>
          </section>
          {readiness?.binding && (
            <section className="grid gap-3 rounded-xl border border-border p-4">
              <h2 className="font-bold">Environment secrets</h2>
              <p role="status">
                {readiness.ready
                  ? "Required environment secrets are configured."
                  : `Missing: ${readiness.missingSecrets.join(", ")}`}
              </p>
              <label className="grid gap-1 text-sm">
                Secret name
                <Input
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Secret value
                <Input
                  type="password"
                  autoComplete="off"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                The value goes directly through Wuff’s server to Cursor. Wuff
                does not store it or return it to chat. Saving an existing name
                updates that secret.
              </p>
              <Button
                disabled={busy || !secretName || !secretValue}
                onClick={() =>
                  act("secret", { name: secretName, value: secretValue })
                }
              >
                Save secret securely
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
