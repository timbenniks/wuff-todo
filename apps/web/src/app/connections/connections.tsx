"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function Connections() {
  const [clients, setClients] = useState<{ id: string; name: string }[] | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/v1/connections")
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Ruff patch! Couldn’t load connections. Try again.");
        setClients(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      {error && (
        <p role="alert" className="text-red-800 mb-4">
          {error}
        </p>
      )}
      {clients === null ? (
        <p role="status">Fetching your AI pack…</p>
      ) : clients.length === 0 ? (
        <p className="text-slate-500">
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
                variant="outline"
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
                        "Ruff patch! Couldn’t disconnect. Try again.",
                      );
                    setClients(clients.filter((c) => c.id !== client.id));
                  } catch (e) {
                    setError((e as Error).message);
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
