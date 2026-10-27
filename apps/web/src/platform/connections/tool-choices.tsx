"use client";
import { useEffect, useRef, useState } from "react";
import {
  type McpToolPreferences,
  type McpToolsUpdate,
  selectMcpToolGroup,
  mcpToolAvailability,
} from "@wuff/contracts";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useActorApi } from "@wuff/ui/features/actor-api";

function GroupChoice({
  label,
  selected,
  total,
  disabled,
  onChange,
}: {
  label: string;
  selected: number;
  total: number;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current)
      ref.current.indeterminate = selected > 0 && selected < total;
  }, [selected, total]);
  return (
    <label className="flex items-center gap-3 min-h-11 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        checked={selected === total}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">
        {selected}/{total}
      </span>
    </label>
  );
}
export function ToolChoices({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const api = useActorApi();
  const [data, setData] = useState<McpToolPreferences | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const pending = useRef<McpToolsUpdate | null>(null);
  useEffect(() => {
    let disposed = false;
    setData(null);
    setError("");
    api<McpToolPreferences>(
      `/api/v1/connections/tools?clientId=${encodeURIComponent(clientId)}`,
    )
      .then((value) => {
        if (!disposed) {
          setData(value);
          setSelected(value.enabledTools);
          pending.current = null;
        }
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
    };
  }, [api, clientId, attempt]);
  function change(next: string[]) {
    setSelected(next);
    setSaved(false);
  }
  const blocked =
    data?.catalog.filter((tool) => {
      const state = mcpToolAvailability(tool.id, data.grantedScopes, selected);
      return state.selected && !state.available;
    }) ?? [];
  return (
    <section
      className="rounded-xl border border-border bg-surface p-4 my-4"
      aria-label="MCP tool choices"
    >
      <h3 className="text-lg font-semibold">
        Choose tools{data ? ` · ${data.clientName}` : ""}
      </h3>
      <p className="text-sm text-muted-foreground my-3">
        Select tools for this connection. A selected tool is available only when
        this connection also has permission. These choices are separate from the
        apps shown in your menu and never grant extra permissions.
      </p>
      {error && (
        <p role="alert" className="text-red-800 my-3">
          {error}
        </p>
      )}
      {!data ? (
        <>
          <p role="status">
            {error ? "Could not load tool choices." : "Loading tool choices…"}
          </p>
          {error && (
            <Button onClick={() => setAttempt((n) => n + 1)}>
              Retry loading
            </Button>
          )}
        </>
      ) : (
        <>
          {blocked.length > 0 && (
            <p role="status" className="text-sm my-3">
              {blocked.length} selected tools need additional permission and
              cannot run. Reconnect in your AI client and approve the missing
              permissions. For Totake, select Read Totake and, for actions,
              Change Totake on the consent page. If those choices are absent,
              configure your AI client to request totake:read and totake:write.
              Saving tool choices or refreshing the tool catalogue does not
              approve access.
            </p>
          )}
          {data.groups
            .filter((group) => group.id !== "connections")
            .map((group) => {
              const tools = data.catalog.filter(
                (tool) => tool.group === group.id && !tool.control,
              );
              const count = tools.filter((tool) =>
                selected.includes(tool.id),
              ).length;
              const available = tools.filter(
                (tool) =>
                  mcpToolAvailability(tool.id, data.grantedScopes, selected)
                    .available,
              ).length;
              return (
                <div key={group.id} className="border-t border-border py-2">
                  <GroupChoice
                    label={group.title}
                    selected={count}
                    total={tools.length}
                    disabled={busy || !!pending.current}
                    onChange={(checked) =>
                      change(selectMcpToolGroup(selected, group.id, checked))
                    }
                  />
                  <p className="text-sm text-muted-foreground mb-2">
                    {count} selected · {available} with permission
                    {count > available
                      ? ` · ${count - available} need consent`
                      : ""}
                  </p>
                  <details>
                    <summary className="text-sm text-muted-foreground cursor-pointer py-3 min-h-11">
                      Individual {group.title} tools
                    </summary>
                    <div className="grid gap-x-6 sm:grid-cols-2">
                      {tools.map((tool) => {
                        const state = mcpToolAvailability(
                          tool.id,
                          data.grantedScopes,
                          selected,
                        );
                        return (
                          <label
                            key={tool.id}
                            className="flex items-start gap-3 py-2 min-h-11 text-sm"
                          >
                            <input
                              className="mt-1"
                              type="checkbox"
                              checked={selected.includes(tool.id)}
                              disabled={busy || !!pending.current}
                              onChange={(e) =>
                                change(
                                  e.target.checked
                                    ? [...selected, tool.id]
                                    : selected.filter((id) => id !== tool.id),
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block">{tool.title}</span>
                              <code className="block text-xs text-muted-foreground break-all">
                                {tool.id}
                              </code>
                              {state.missingScopes.length > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  {state.selected
                                    ? "Selected, awaiting consent"
                                    : "Requires consent"}
                                  : {state.missingScopes.join(", ")}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>
              );
            })}
          <p className="text-sm text-muted-foreground my-3">
            Connection controls stay available within your granted permissions.
            AI clients can turn tools off; re-enable them here. New optional
            tools stay off after you save a selection.
          </p>
          {saved && (
            <p role="status" className="my-3">
              Tool choices saved.{" "}
              {blocked.length > 0
                ? "Selected tools awaiting consent remain unavailable. Reconnect and approve access first."
                : "Refresh the connection’s tools in your AI client."}{" "}
              Disabled tools are blocked immediately.
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                setSaved(false);
                pending.current ??= {
                  clientId,
                  version: data.version,
                  enabledTools: selected as McpToolsUpdate["enabledTools"],
                  operationId: crypto.randomUUID(),
                };
                try {
                  const value = await api<McpToolPreferences>(
                    "/api/v1/connections/tools",
                    "PUT",
                    pending.current,
                  );
                  setData(value);
                  setSelected(value.enabledTools);
                  pending.current = null;
                  setSaved(true);
                } catch (e) {
                  if (e instanceof ApiError && e.status < 500)
                    pending.current = null;
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Saving…"
                : pending.current
                  ? "Retry save"
                  : "Save tool choices"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                pending.current = null;
                setSaved(false);
                setAttempt((n) => n + 1);
              }}
            >
              Load latest choices
            </Button>
          </div>
        </>
      )}
      <Button
        variant="outline"
        className="mt-3"
        disabled={busy}
        onClick={onClose}
      >
        {saved ? "Close" : "Cancel"}
      </Button>
    </section>
  );
}
