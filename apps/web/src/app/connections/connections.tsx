"use client";
import { wuffError } from "@/lib/copy";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function Connections() {
  const [clients, setClients] = useState<{ id: string; name: string }[] | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError("");
    fetch("/api/v1/connections")
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "We lost the scent! Couldn’t load your AI connections. Try again.",
          );
        setClients(await r.json());
      })
      .catch((e) => setError(wuffError(e.message)));
  }, [attempt]);
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
              className="flex items-center justify-between gap-4 py-4"
            >
              <span>{client.name}</span>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await fetch("/api/v1/connections", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ clientId: client.id }),
                    });
                    if (!r.ok)
                      throw new Error(
                        "Ruff break! The AI client wasn’t disconnected. Try again.",
                      );
                    setClients(clients.filter((c) => c.id !== client.id));
                  } catch (e) {
                    setError(wuffError((e as Error).message));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
