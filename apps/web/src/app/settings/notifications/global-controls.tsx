"use client";
import { useRef, useState } from "react";
import { Button } from "@wuff/ui/button";
import { useActorApi } from "@wuff/ui/features/actor-api";
import { ApiError } from "@wuff/ui/features/api";
import type {
  NotificationSettings,
  NotificationSettingsUpdate,
} from "@wuff/contracts";
export function GlobalNotificationControls({
  initial,
}: {
  initial: NotificationSettings;
}) {
  const api = useActorApi();
  const [saved, setSaved] = useState(initial),
    [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef<NotificationSettingsUpdate | null>(null),
    active = useRef(false);
  async function send(input: NotificationSettingsUpdate) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await api<NotificationSettings>(
        "/api/v1/notifications",
        "PUT",
        input,
      );
      setSaved(next);
      setDraft(next);
      pending.current = null;
      setUncertain(false);
      setConflict(false);
      setNotice("Notification settings saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not confirm the save.",
      );
      if (err instanceof ApiError && err.status < 500) {
        pending.current = null;
        setUncertain(false);
        setConflict(err.status === 409);
      } else {
        pending.current = input;
        setUncertain(true);
      }
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <h2>Shared notification controls</h2>
      <p className="settings-description">
        Pausing stops delivery. It does not mark tasks or medication as done.
        Hiding an app in your Empire has no effect on notifications.
      </p>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? "Saving…" : notice}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending.current && !conflict)
            void send({
              operationId: crypto.randomUUID(),
              version: saved.version,
              paused: draft.paused,
              apps: draft.apps,
              showContent: draft.showContent,
            });
        }}
      >
        <fieldset
          disabled={busy || uncertain || conflict}
          className="grid gap-4 my-4"
        >
          <label className="flex gap-3 items-center min-h-11">
            <input
              type="checkbox"
              checked={draft.paused}
              onChange={(e) => setDraft({ ...draft, paused: e.target.checked })}
            />
            Pause all Wuff notifications
          </label>
          {(["todo", "totake"] as const).map((app) => (
            <label key={app} className="flex gap-3 items-center min-h-11">
              <input
                type="checkbox"
                checked={draft.apps[app]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    apps: { ...draft.apps, [app]: e.target.checked },
                  })
                }
              />
              Pause {app === "todo" ? "Wuff Todo" : "Wuff Totake"} notifications
            </label>
          ))}
          <label className="flex gap-3 items-center min-h-11">
            <input
              type="checkbox"
              checked={draft.showContent}
              onChange={(e) =>
                setDraft({ ...draft, showContent: e.target.checked })
              }
            />
            Show reminder details on the lock screen
          </label>
          <p>
            Keep this off for a generic “Open Wuff” message. Todo’s own title
            privacy also applies.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" type="submit">
              Save notification settings
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDraft(saved);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
      {uncertain && (
        <Button
          disabled={busy}
          onClick={() => pending.current && send(pending.current)}
        >
          Retry the same save
        </Button>
      )}
      {conflict && (
        <Button
          onClick={async () => {
            try {
              const next = await api<NotificationSettings>(
                "/api/v1/notifications",
              );
              setSaved(next);
              setDraft(next);
              setConflict(false);
              setError("");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not load settings.",
              );
            }
          }}
        >
          Load latest settings
        </Button>
      )}
      <p className="settings-description">
        Resuming sends no historical repeat backlog. Todo daily reminders resume
        at their next scheduled time; Totake checks each unresolved time group
        once before continuing its cadence. Real delivery also requires device
        permission and a configured service.
      </p>
    </section>
  );
}
