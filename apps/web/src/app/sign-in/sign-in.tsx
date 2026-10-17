"use client";
import { Input } from "@/components/ui/input";

import { useId, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export function SignIn({ next }: { next: string }) {
  const errorId = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        const data = new FormData(event.currentTarget);
        try {
          const result = await authClient.signIn.email({
            email: String(data.get("email")),
            password: String(data.get("password")),
          });
          if (result.error)
            setError(
              "Ruff start! Sign-in failed. Check your email and password and try again.",
            );
          else window.location.assign(next);
        } catch {
          setError("Ruff connection! Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
      className="grid gap-5"
    >
      <label className="grid gap-2 text-sm font-semibold">
        Email
        <Input
          aria-describedby={error ? errorId : undefined}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Password
        <Input
          aria-describedby={error ? errorId : undefined}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-red-800 text-sm">
          {error}
        </p>
      )}
      <Button variant="primary" type="submit" disabled={busy}>
        {busy ? "Sniffing out your lists…" : "Sign in"}
      </Button>
    </form>
  );
}
