"use client";
import { wuffError } from "@/lib/copy";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function Consent({
  query,
  optionalPermissions = [],
}: {
  query: string;
  optionalPermissions?: readonly {
    scope: string;
    label: string;
    description: string;
  }[];
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [optionalScopes, setOptionalScopes] = useState<string[]>([]);
  async function decide(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/oauth/authorize/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, accept, optionalScopes }),
      });
      const data = await result.json();
      if (!result.ok)
        throw new Error(
          data.error?.message ?? "Ruff connection! Please try again.",
        );
      window.location.assign(data.redirect);
    } catch (e) {
      setError(wuffError((e as Error).message));
      setBusy(false);
    }
  }
  return (
    <div>
      {optionalPermissions.length > 0 && (
        <fieldset disabled={busy} className="my-6">
          <legend className="font-semibold">Optional Totake access</legend>
          <p className="text-sm text-muted-foreground my-2">
            Approve access for this connection. Tool choices in Settings can
            limit this access, but cannot grant it. Leave unchecked to keep Todo
            only.
          </p>
          {optionalPermissions.map((permission) => (
            <label
              key={permission.scope}
              className="flex items-start gap-3 py-3 min-h-11"
            >
              <input
                className="mt-1"
                type="checkbox"
                checked={optionalScopes.includes(permission.scope)}
                disabled={
                  permission.scope === "totake:write" &&
                  !optionalScopes.includes("totake:read")
                }
                onChange={(event) =>
                  setOptionalScopes((current) =>
                    event.target.checked
                      ? [...current, permission.scope]
                      : current.filter(
                          (scope) =>
                            scope !== permission.scope &&
                            !(
                              permission.scope === "totake:read" &&
                              scope === "totake:write"
                            ),
                        ),
                  )
                }
              />
              <span>
                <span className="block font-medium">{permission.label}</span>
                <span className="block text-sm text-muted-foreground">
                  {permission.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-red-800 mb-4">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="primary" disabled={busy} onClick={() => decide(true)}>
          Allow connection
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => decide(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
