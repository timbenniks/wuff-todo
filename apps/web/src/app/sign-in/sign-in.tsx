"use client";
import { Input } from "@/components/ui/input";

import { useId, useState } from "react";
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
          const response = await fetch("/api/auth/sign-in/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: String(data.get("email")),
              password: String(data.get("password")),
            }),
          });
          if (response.ok) window.location.assign(next);
          else
            setError(
              response.status === 429
                ? "Too many sign-in attempts. Wait a minute and try again."
                : response.status >= 500
                  ? "Sign-in is temporarily unavailable. Try again shortly."
                  : "Sign-in failed. Check your email and password, or reset your password.",
            );
        } catch {
          setError(
            "We couldn’t reach Wuff. Check your connection and try again.",
          );
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
          autoComplete="username"
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
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
