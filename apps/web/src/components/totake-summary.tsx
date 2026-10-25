"use client";
import { useEffect, useState } from "react";
import { useActorApi } from "@wuff/ui/features/actor-api";
import { Button } from "@wuff/ui/button";
import type { TotakeSummary } from "@wuff/contracts";
export function TotakeSummaryCard({ userId }: { userId: string }) {
  const api = useActorApi(),
    [data, setData] = useState<TotakeSummary | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false,
      generation = 0;
    async function refresh() {
      const current = ++generation;
      try {
        const next = await api<TotakeSummary>("/api/v1/totake/summary");
        if (!cancelled && current === generation && next.userId === userId) {
          setData(next);
          setError("");
        }
      } catch {
        if (!cancelled && current === generation) {
          setData(null);
          setError("Could not load your Totake overview.");
        }
      }
    }
    void refresh();
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    const interval = setInterval(focus, 10000);
    window.addEventListener("focus", focus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [api, userId, retry]);
  return (
    <section className="empire-todo" aria-labelledby="empire-totake-title">
      <header className="empire-section-heading">
        <h2 id="empire-totake-title">From Wuff Totake</h2>
        <a href="/totake" className="empire-text-link">
          Open daily overview →
        </a>
      </header>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>
            Retry Totake overview
          </Button>
        </div>
      ) : data ? (
        <div className="empire-preview">
          <p>
            {data.today} items unrecorded today · {data.overdue} overdue ·{" "}
            {data.recordedToday} recorded today
          </p>
          {data.lowStock > 0 && <p>{data.lowStock} items low on stock</p>}
          {data.next.length > 0 && (
            <ul>
              {data.next.map((g) => (
                <li key={g.id}>
                  <a
                    className="empire-text-link"
                    href={"/totake?reminder=" + encodeURIComponent(g.id)}
                  >
                    {new Date(g.at)
                      .toLocaleString("en-GB", {
                        timeZone: data.timezone,
                        year: "numeric",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                      .replaceAll("/", "-")}{" "}
                    · {g.count} items
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p role="status">Fetching your Totake overview…</p>
      )}
    </section>
  );
}
