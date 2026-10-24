import { redirect } from "next/navigation";
import { pageActor } from "@/lib/auth/server";
import { listLists } from "@wuff/domain";
import { GithubConnections } from "./connections";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string; error?: string }>;
}) {
  let actor;
  try {
    actor = await pageActor();
  } catch {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const lists = (await listLists(actor)).filter(
    (l) => l.ownerId === actor.id && !l.archived,
  );
  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-8">
      <a href="/lists" className="text-primary underline">
        ← Your lists
      </a>
      <h1 className="text-3xl font-bold mt-6 mb-3">GitHub connections</h1>
      <p className="text-muted-foreground mb-6">
        Connect a repository to a Work list, then explicitly link the tasks you
        want to synchronize. List members can see linked issue content.
      </p>
      {params.error && (
        <p role="alert" className="text-destructive mb-4">
          GitHub authorization could not be verified. Connect again.
        </p>
      )}
      <GithubConnections
        lists={lists}
        initialId={params.listId}
        userId={actor.id}
      />
    </main>
  );
}
