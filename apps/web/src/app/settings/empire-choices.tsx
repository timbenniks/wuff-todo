"use client";
import { useEffect, useState } from "react";
import {
  empireAppPreference,
  type EmpireSettings,
  type EmpireSettingsUpdate,
} from "@wuff/contracts";
import { useEmpirePreferences } from "@/components/empire-preferences";
import { Button } from "@wuff/ui/button";
import { api, ApiError } from "@/lib/api";

export function EmpireChoices({ mode }: { mode: "visible" | "dashboard" }) {
  const preferences = useEmpirePreferences();
  return (
    <section>
      <h2>{mode === "visible" ? "Your apps" : "Dashboard"}</h2>
      <p className="settings-description">
        {mode === "visible"
          ? "Choose which apps appear in your menu and homepage. Your choices only change your Empire."
          : "Choose which app summaries appear on your homepage. Each app keeps its own detailed overview settings."}
      </p>
      <p className="settings-note">
        Hiding an app keeps its data, reminders and connections. Manage delivery
        in <a href="/settings/notifications">Notifications</a> and permissions
        in <a href="/settings/connections">AI & MCP connections</a>.
      </p>
      {preferences.error && (
        <div role="alert">
          <p>{preferences.error}</p>
          <Button onClick={() => void preferences.refresh()}>
            Retry settings
          </Button>
        </div>
      )}
      {preferences.settings ? (
        <ChoicesForm
          key={preferences.settings.userId + mode}
          initial={preferences.settings}
          mode={mode}
        />
      ) : (
        !preferences.error && <p role="status">Fetching your choices…</p>
      )}
    </section>
  );
}
function ChoicesForm({
  initial,
  mode,
}: {
  initial: EmpireSettings;
  mode: "visible" | "dashboard";
}) {
  const { accept } = useEmpirePreferences();
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(initial.apps);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<EmpireSettingsUpdate | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const changes = initial.catalog.flatMap((app) => {
    if (mode === "dashboard" && !app.hasDashboard) return [];
    const value = empireAppPreference(draft, app.id)[mode];
    return value === empireAppPreference(base.apps, app.id)[mode]
      ? []
      : [{ appId: app.id, [mode]: value }];
  });
  const dirty = changes.length > 0;
  useEffect(() => {
    if (!dirty && !pending && !busy && initial.version !== base.version) {
      setBase(initial);
      setDraft(initial.apps);
    }
  }, [initial, base.version, dirty, pending, busy]);
  async function save(input: EmpireSettingsUpdate) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await api<EmpireSettings>(
        "/api/v1/empire",
        "PUT",
        input,
        base.userId,
      );
      accept(next);
      setBase(next);
      setDraft(next.apps);
      setPending(null);
      setNotice("Your choices are saved.");
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500)
        setPending(input);
      else setPending(null);
      setError(
        error instanceof Error ? error.message : "Couldn’t save your choices.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && dirty && !pending)
          void save({
            version: base.version,
            operationId: crypto.randomUUID(),
            changes,
          });
      }}
    >
      <fieldset disabled={busy || !!pending} className="empire-choice-list">
        <legend className="sr-only">
          {mode === "visible" ? "App visibility" : "Dashboard summaries"}
        </legend>
        {initial.catalog.map((app) => (
          <label className="empire-choice-row" key={app.id}>
            <span>
              <strong>{app.name}</strong>
              <span className="block text-sm text-muted-foreground">
                {app.status === "coming-soon"
                  ? "Coming soon · no dashboard summary yet"
                  : mode === "visible"
                    ? "Show in my Empire"
                    : !empireAppPreference(draft, app.id).visible
                      ? "This app is hidden. Show it in Your apps to display its summary."
                      : "Show dashboard summary"}
              </span>
            </span>
            <input
              type="checkbox"
              aria-label={`${mode === "visible" ? "Show" : "Summarize"} ${app.name}`}
              checked={empireAppPreference(draft, app.id)[mode]}
              disabled={mode === "dashboard" && !app.hasDashboard}
              onChange={(event) => {
                setDraft((old) => ({
                  ...old,
                  [app.id]: {
                    ...empireAppPreference(old, app.id),
                    [mode]: event.target.checked,
                  },
                }));
                setNotice("");
              }}
            />
          </label>
        ))}
      </fieldset>
      {mode === "dashboard" && (
        <a className="empire-text-link" href="/settings/todo">
          Customize Todo’s overview
        </a>
      )}
      <div className="empire-settings-actions">
        <Button
          variant="primary"
          disabled={busy || !dirty || !!pending}
          type="submit"
        >
          {busy ? "Saving…" : "Save choices"}
        </Button>
        <Button
          type="button"
          disabled={busy || !!pending || !dirty}
          onClick={() => {
            setBase(initial);
            setDraft(initial.apps);
            setError("");
          }}
        >
          Cancel
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div role="alert" className="settings-note">
          <p>{error}</p>
          {pending ? (
            <>
              <p>
                The save is unconfirmed. Retry the same request before making
                another change.
              </p>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void save(pending)}
              >
                Retry same request
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                try {
                  const next = await api<EmpireSettings>(
                    "/api/v1/empire",
                    "GET",
                    undefined,
                    base.userId,
                  );
                  accept(next);
                  setBase(next);
                  setDraft(next.apps);
                  setError("");
                } catch {
                  setError(
                    "Couldn’t load the latest settings. Your draft is kept.",
                  );
                }
              }}
            >
              Load latest settings
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
