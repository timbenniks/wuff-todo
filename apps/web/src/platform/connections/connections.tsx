"use client";
import { ToolChoices } from "./tool-choices";
import { wuffError } from "@/lib/copy";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { connectionPermissionLabels, type AiConnection } from "@wuff/contracts";
import { useActorApi } from "@wuff/ui/features/actor-api";
export function Connections() {
  const pending = useRef<{ clientId: string; operationId: string } | null>(
    null,
  );
  const actorApi = useActorApi();
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    setEditing(new URLSearchParams(window.location.search).get("clientId"));
  }, []);
  const [clients, setClients] = useState<AiConnection[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError("");
    let disposed = false;
    actorApi<AiConnection[]>("/api/v1/connections")
      .then((data) => {
        if (!disposed) setClients(data);
      })
      .catch((error) => {
        if (!disposed) {
          setClients(null);
          setError(wuffError(error.message));
        }
      });
    return () => {
      disposed = true;
    };
  }, [attempt, actorApi]);
  return (
    <div>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 text-red-800 p-4 mb-4"
        >
          <p>{error}</p>
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry connections
          </Button>
        </div>
      )}
      {clients === null ? (
        !error && <p role="status">Fetching your AI pack…</p>
      ) : clients.length === 0 ? (
        <p className="text-muted-foreground">
          No AI pals in your pack yet. Connect a client to get started.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {clients.map((client) => (
            <li
              key={client.id}
              data-client-id={client.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <span className="min-w-0 flex-1 basis-48 break-words">
                {client.name}
                <span className="block text-sm text-muted-foreground">
                  {client.state === "authorized"
                    ? "Authorized"
                    : "Expired · reconnect in your AI client"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {client.scopes.length
                    ? client.scopes
                        .map(
                          (scope) => connectionPermissionLabels[scope] ?? scope,
                        )
                        .join(" · ")
                    : "No active permissions"}
                </span>
              </span>
              {client.mcp && (
                <Button
                  variant="outline"
                  aria-expanded={editing === client.id}
                  disabled={busy || !!pending.current || editing === client.id}
                  onClick={() => setEditing(client.id)}
                >
                  Choose tools
                </Button>
              )}
              <Button
                variant="danger"
                disabled={
                  busy ||
                  !!editing ||
                  (!!pending.current && pending.current.clientId !== client.id)
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  pending.current ??= {
                    clientId: client.id,
                    operationId: crypto.randomUUID(),
                  };
                  try {
                    await actorApi(
                      "/api/v1/connections",
                      "DELETE",
                      pending.current,
                    );
                    pending.current = null;
                    setClients(clients.filter((c) => c.id !== client.id));
                    if (editing === client.id) setEditing(null);
                  } catch (e) {
                    if (e instanceof ApiError && e.status < 500)
                      pending.current = null;
                    setError(wuffError((e as Error).message));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy && pending.current?.clientId === client.id
                  ? "Disconnecting…"
                  : pending.current?.clientId === client.id
                    ? "Retry disconnect"
                    : "Disconnect"}
              </Button>
              {editing === client.id && client.mcp && (
                <div className="basis-full min-w-0">
                  <ToolChoices
                    key={editing}
                    clientId={editing}
                    onClose={() => setEditing(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
