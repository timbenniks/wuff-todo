import { Corgi } from "@/components/corgi";
import { SignIn } from "./sign-in";
import Link from "next/link";
import { signInReturnPath } from "@/lib/auth/return-path";
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = (await searchParams).next;
  const safeNext = signInReturnPath(next);
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <Corgi />
          <span className="wordmark text-2xl font-bold">
            Wuff Todo
            <span className="block font-sans text-xs tracking-normal font-medium text-muted-foreground mt-1">
              Less to remember. More tail wags.
            </span>
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-3">Wuff, welcome back.</h1>
        <p className="text-muted-foreground mb-8">
          Your pack of lists is right where you left it.
        </p>
        <SignIn next={safeNext} />
        <Link
          href="/set-password"
          className="block text-sm font-semibold underline underline-offset-4 mt-6"
        >
          New to the pack or fur-got your password?
        </Link>
        <p className="text-sm text-muted-foreground mt-8 border-t border-border pt-6">
          Our pack is invite-only. Wuff is a private space for friends and
          family; you’ll need an invitation to join.
        </p>
      </div>
    </main>
  );
}
