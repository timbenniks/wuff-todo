import Link from "next/link";
import { Corgi } from "@/components/corgi";
import { SetPassword } from "./set-password";

export default function SetPasswordPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/sign-in" className="flex items-center gap-3 mb-12">
          <Corgi />
          <span className="wordmark text-2xl font-bold">Wuff Todo</span>
        </Link>
        <h1 className="text-3xl font-bold mb-3">Make yourself at home.</h1>
        <p className="text-slate-500 mb-8">
          Set your first password or reset a forgotten one using a code sent to
          your email.
        </p>
        <SetPassword />
      </div>
    </main>
  );
}
