"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export function SignIn({ next }: { next: string }) {
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
              "Sign-in failed. Check your email and password and try again.",
            );
          else window.location.assign(next);
        } catch {
          setError("We couldn’t connect. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
      className="grid gap-5"
    >
      <label className="grid gap-2 text-sm font-semibold">
        Email
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p role="alert" className="text-red-800 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
