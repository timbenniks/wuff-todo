"use client";
import { useState, useRef } from "react";
import { Button } from "../../button";
import { NativeSelect } from "../../native-select";
import { useActorApi } from "../../features/actor-api";
import { listPalette } from "@wuff/design";
import type { NotesSettings } from "@wuff/contracts";
import { uncertainNotesError } from "./recovery";
export function NotesSettingsPanel({ initial }: { initial: NotesSettings }) {
  const api = useActorApi(),
    [saved, setSaved] = useState(initial),
    [draft, setDraft] = useState(initial.settings),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const pending = useRef<{
      version: number;
      settings: NotesSettings["settings"];
      operationId: string;
    } | null>(null),
    [uncertain, setUncertain] = useState(false);
  async function save() {
    const request = pending.current ?? {
      version: saved.version,
      settings: draft,
      operationId: crypto.randomUUID(),
    };
    pending.current = request;
    setBusy(true);
    setError("");
    try {
      const next = await api<NotesSettings>(
        "/api/v1/notes/settings",
        "PUT",
        request,
      );
      setSaved(next);
      setDraft(next.settings);
      pending.current = null;
      setUncertain(false);
      setFeedback("Your Notes preferences are saved.");
    } catch (e) {
      setError((e as Error).message);
      if (uncertainNotesError(e)) setUncertain(true);
      else {
        pending.current = null;
        setUncertain(false);
      }
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      const next = await api<NotesSettings>("/api/v1/notes/settings");
      setSaved(next);
      setDraft(next.settings);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Notes preferences</h2>
      <p className="settings-description">
        Choose defaults for new notes and what your Notes dashboard card shows.
        Existing and shared notes keep their own themes.
      </p>
      <div className="notes-editor-panel">
        <label>
          Default format
          <NativeSelect
            aria-label="Default Notes format"
            value={draft.defaultMode}
            disabled={busy || uncertain}
            onChange={(e) =>
              setDraft({
                ...draft,
                defaultMode: e.target.value as "note" | "moodboard",
              })
            }
          >
            <option value="note">Note</option>
            <option value="moodboard">Moodboard</option>
          </NativeSelect>
        </label>
        <label>
          Default theme
          <NativeSelect
            aria-label="Default Notes theme"
            value={draft.defaultTheme}
            disabled={busy || uncertain}
            onChange={(e) =>
              setDraft({
                ...draft,
                defaultTheme: e.target.value as typeof draft.defaultTheme,
              })
            }
          >
            {Object.entries(listPalette).map(([id, p]) => (
              <option value={id} key={id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Dashboard selection
          <NativeSelect
            aria-label="Notes dashboard selection"
            value={draft.dashboard}
            disabled={busy || uncertain}
            onChange={(e) =>
              setDraft({
                ...draft,
                dashboard: e.target.value as "pinned" | "recent",
              })
            }
          >
            <option value="pinned">Pinned notes</option>
            <option value="recent">Recent notes</option>
          </NativeSelect>
        </label>
        <label>
          Maximum notes on dashboard
          <NativeSelect
            aria-label="Notes dashboard count"
            value={String(draft.dashboardLimit)}
            disabled={busy || uncertain}
            onChange={(e) =>
              setDraft({ ...draft, dashboardLimit: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </NativeSelect>
        </label>
        <p>
          Enable the Notes card in{" "}
          <a className="empire-text-link" href="/settings/dashboard">
            Empire Dashboard settings
          </a>
          . Menu visibility and AI permissions are separate choices.
        </p>
        {error && <p role="alert">{error}</p>}
        {feedback && <p role="status">{feedback}</p>}
        <div className="notes-actions">
          <Button disabled={busy} onClick={() => void save()}>
            {uncertain ? "Retry same request" : "Save Notes preferences"}
          </Button>
          <Button
            variant="outline"
            disabled={busy || uncertain}
            onClick={() => {
              setDraft(saved.settings);
              setError("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            disabled={busy || uncertain}
            onClick={() => void reload()}
          >
            Load latest preferences
          </Button>
        </div>
      </div>
    </section>
  );
}
