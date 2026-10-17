"use client";
import { wuffError } from "@/lib/copy";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function Consent({ query }: { query: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await fetch("/oauth/authorize/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, accept }),
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
