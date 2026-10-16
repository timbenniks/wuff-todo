"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SetPassword() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password" | "done">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (step === "done")
    return (
      <div className="grid gap-6">
        <p role="status">
          Paw-some, your password is ready. Sign in and fetch your lists.
        </p>
        <Link
          href="/sign-in"
          className="font-semibold underline underline-offset-4"
        >
          Continue to sign in
        </Link>
      </div>
    );
  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError("");
        if (
          step === "password" &&
          data.get("password") !== data.get("confirm")
        ) {
          setError("Ruff match! Your passwords don’t match.");
          return;
        }
        setBusy(true);
        try {
          // Use the managed service's documented endpoints. The installed SDK's
          // emailOtp.resetPassword helper maps to a different, unsupported path.
          const response = await fetch(
            `/api/auth/email-otp/${step === "email" ? "request-password-reset" : "reset-password"}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                step === "email"
                  ? { email }
                  : {
                      email,
                      otp: String(data.get("otp")).trim(),
                      password: String(data.get("password")),
                    },
              ),
            },
          );
          if (!response.ok) {
            setError(
              response.status === 429
                ? "Paws for a minute before trying again."
                : step === "email"
                  ? "Ruff delivery! We couldn’t send a code. Please try again shortly."
                  : "Ruff patch! We couldn’t set your password. Check the code or request a new one.",
            );
          } else setStep(step === "email" ? "password" : "done");
        } catch {
          setError("Ruff connection! Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {step === "email" ? (
        <label className="grid gap-2 text-sm font-semibold">
          Your invited email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </label>
      ) : (
        <>
          <p role="status" className="text-sm text-slate-600">
            If {email} has been invited, a code is on its way. Fetch it from
            your inbox and spam folder.
          </p>
          <label className="grid gap-2 text-sm font-semibold">
            Email code
            <input
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Confirm password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <p className="text-xs text-slate-500">
            Keep your pack protected: use at least 8 characters. Codes expire
            after a few minutes.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-800 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy
          ? "Just a little paws…"
          : step === "email"
            ? "Send me a code"
            : "Save password"}
      </Button>
      {step === "password" && (
        <button
          type="button"
          disabled={busy}
          className="text-sm underline underline-offset-4"
          onClick={() => {
            setError("");
            setStep("email");
          }}
        >
          Request another code or change email
        </button>
      )}
      <Link
        href="/sign-in"
        className="text-sm text-slate-500 underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </form>
  );
}
