"use client";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function SetPassword() {
  const errorId = useId(),
    hintId = useId();
  const codeInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "password" | "done">("email");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [wait, setWait] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  function cooldown(seconds: number) {
    setWait(seconds);
    setResendAt(Date.now() + seconds * 1000);
  }
  const sending = useRef(false);
  useEffect(() => {
    if (step === "password") codeInput.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!resendAt) return;
    const tick = () =>
      setWait(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  async function sendCode() {
    if (sending.current || wait) return;
    sending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        "/api/auth/email-otp/request-password-reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      if (!response.ok) {
        if (response.status === 429) {
          cooldown(60);
          throw Error(
            "Too many code requests. Wait a minute before trying again.",
          );
        }
        throw Error(
          "We couldn’t request a code. Check your connection and try again.",
        );
      }
      setStep("password");
      setOtp("");
      cooldown(30);
      setNotice(
        "If this email has been invited, a code is on its way. Check your inbox and spam folder.",
      );
      codeInput.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function save(form: HTMLFormElement) {
    const fields = new FormData(form);
    const password = String(fields.get("password") ?? ""),
      confirm = String(fields.get("confirm") ?? "");
    if (sending.current) return;
    setError("");
    setNotice("");
    if (password !== confirm) {
      setError("Your passwords don’t match. Enter the same password twice.");
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/email-otp/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim(), password }),
      });
      if (!response.ok)
        throw Error(
          response.status === 429
            ? "Too many attempts. Wait a minute before trying again."
            : "We couldn’t save your password. Check the code and password, or request a new code if it expired.",
        );
      form.reset();
      setOtp("");
      setStep("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  if (step === "done")
    return (
      <div className="grid gap-6">
        <p role="status">Your password is saved. You can now sign in.</p>
        <Button variant="primary" asChild>
          <Link href="/sign-in">Continue to sign in</Link>
        </Button>
      </div>
    );
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void (step === "email" ? sendCode() : save(e.currentTarget));
      }}
    >
      {step === "email" ? (
        <label className="grid gap-2 text-sm font-semibold">
          Your invited email
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
      ) : (
        <>
          <p className="text-sm break-words">
            Code requested for <strong>{email}</strong>.
          </p>
          <label className="grid gap-2 text-sm font-semibold">
            Email code
            <Input
              ref={codeInput}
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={12}
              required
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\s/g, "").slice(0, 6))
              }
              disabled={busy}
              aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            New password
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              disabled={busy}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Confirm password
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              disabled={busy}
              aria-describedby={error ? errorId : undefined}
            />
          </label>
          <p id={hintId} className="text-xs text-muted-foreground">
            Paste the six-digit code from your email. Codes expire; request a
            new one if needed. Use a password of 8–128 characters. Password
            managers are supported.
          </p>
        </>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-red-800 text-sm">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        type="submit"
        disabled={busy || (step === "email" && wait > 0)}
      >
        {busy
          ? "Please wait…"
          : step === "email"
            ? wait
              ? `Send code in ${wait}s`
              : "Send code"
            : "Save password"}
      </Button>
      {step === "password" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || wait > 0}
            onClick={() => void sendCode()}
          >
            {wait ? `Resend code in ${wait}s` : "Resend code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setStep("email");
              setWait(0);
              setResendAt(0);
              setOtp("");
              setError("");
              setNotice("");
            }}
          >
            Change email
          </Button>
        </div>
      )}
      <Link
        href="/sign-in"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Back to sign in
      </Link>
    </form>
  );
}
