"use client";
import { useEffect, useState } from "react";
import { FileText, Pin, ArrowRight } from "lucide-react";
import { useActorApi } from "@wuff/ui/features/actor-api";
import { Button } from "@wuff/ui/button";
import { notePath, type NotesDashboard } from "@wuff/contracts";
export function NotesSummaryCard({ userId }: { userId: string }) {
  const api = useActorApi(),
    [data, setData] = useState<NotesDashboard | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true,
      epoch = 0;
    async function refresh() {
      const generation = ++epoch;
      try {
        const next = await api<NotesDashboard>("/api/v1/notes/dashboard");
        if (active && epoch === generation && next.userId === userId) {
          setData(next);
          setError("");
        }
      } catch {
        if (active && epoch === generation) {
          setData(null);
          setError("Could not load your Notes overview.");
        }
      }
    }
    void refresh();
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    const interval = setInterval(focus, 10000);
    return () => {
      active = false;
      window.removeEventListener("focus", focus);
      clearInterval(interval);
    };
  }, [api, userId, retry]);
  return (
    <section className="empire-todo" aria-labelledby="empire-notes-title">
      <header className="empire-section-heading">
        <h2 id="empire-notes-title">From Wuff Notes</h2>
        <a href="/notes" className="empire-text-link">
          Open Notes <ArrowRight size={17} />
        </a>
      </header>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>
            Retry Notes overview
          </Button>
        </div>
      ) : data ? (
        <div className="empire-preview">
          <ul className="empire-task-list">
            {data.notes.map((note) => (
              <li key={note.id}>
                <a href={notePath(note.id)}>
                  <FileText size={17} />
                  <span className="empire-task-title">{note.title}</span>
                  {note.pinned && <Pin size={15} aria-label="Pinned" />}
                </a>
              </li>
            ))}
          </ul>
          {!data.notes.length && (
            <p className="empire-empty">
              Pin a note to keep it close, or choose recent notes in Notes
              preferences.
            </p>
          )}
        </div>
      ) : (
        <p role="status">Fetching your Notes overview…</p>
      )}
    </section>
  );
}
