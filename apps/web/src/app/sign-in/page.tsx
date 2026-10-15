import { Corgi } from "@/components/corgi";
import { SignIn } from "./sign-in";
import Link from "next/link";
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = (await searchParams).next;
  const safeNext = next?.startsWith("/oauth/authorize?") ? next : "/lists";
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-14">
          <Corgi />
          <span className="wordmark text-2xl font-bold">
            Wuff Todo
            <span className="block font-sans text-xs tracking-normal font-medium text-slate-500 mt-1">
              A little less to remember.
            </span>
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Good to see you.</h1>
        <p className="text-slate-500 mb-8">
          Your lists are right where you left them.
        </p>
        <SignIn next={safeNext} />
        <Link
          href="/set-password"
          className="block text-sm font-semibold underline underline-offset-4 mt-6"
        >
          First visit or forgot your password?
        </Link>
        <p className="text-sm text-slate-500 mt-8 border-t border-border pt-6">
          Wuff is a private space for friends and family. You’ll need an
          invitation to join.
        </p>
      </div>
    </main>
  );
}
