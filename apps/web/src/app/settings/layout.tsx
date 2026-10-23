import { ActorApiProvider } from "../lists/actor-api";
import { SettingsNav } from "./settings-nav";
import { pageActor } from "@/lib/auth/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await pageActor();
  } catch {
    redirect("/sign-in");
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <a href="/lists" className="text-sm text-primary hover:underline">
        ← Back to your lists
      </a>
      <header className="mt-8 mb-8">
        <p className="text-sm text-muted-foreground mb-2">Your Wuff</p>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          A little help, on your terms.
        </p>
      </header>
      <div className="grid gap-8 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0">
          <ActorApiProvider userId={actor.id}>{children}</ActorApiProvider>
        </div>
      </div>
    </main>
  );
}
