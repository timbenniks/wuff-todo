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
        <h1 className="text-3xl font-bold mb-3">Welcome to the pack.</h1>
        <p className="text-slate-500 mb-8">
          New here or fur-got your password? Fetch a code from your email to set
          or reset it.
        </p>
        <SetPassword />
      </div>
    </main>
  );
}
