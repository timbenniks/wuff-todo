import { wuffError } from "@/lib/copy";
import { redirect } from "next/navigation";
import { pageActor, webIdentity } from "@/lib/auth/server";
import { AppError } from "@wuff/contracts";
import type { TodoList } from "@wuff/contracts";
import { getList, listLists, listInvitations } from "@wuff/domain";
import { sealLiveLists } from "@/lib/live-server";
import { ActorApiProvider } from "@/platform/actor-api";
import { ListApp } from "@/modules/todo/web/lists/list-app";
export const metadata = { title: "Wuff Todo · Wuff Empire" };
export const dynamic = "force-dynamic";
export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string; home?: string }>;
}) {
  try {
    const query = await searchParams;
    const requested = query.listId;
    const identity = await webIdentity();
    if (!identity) {
      const destination = requested
        ? `/lists?listId=${encodeURIComponent(requested)}`
        : query.home === "1"
          ? "/lists?home=1"
          : "/lists";
      redirect(`/sign-in?next=${encodeURIComponent(destination)}`);
    }
    const actor = await pageActor();
    const [initialLists, initialInvitations] = await Promise.all([
      listLists(actor),
      listInvitations(actor),
    ]);
    let initialList: TodoList | null = null;
    const first = initialLists.find((l) => l.id === requested);
    if (first) {
      try {
        initialList = await getList(actor, first.id);
      } catch (error) {
        // A concurrent delete/revocation is reconciled by the client's fresh read.
        if (!(error instanceof AppError && error.status === 404)) throw error;
      }
    }
    const liveConfig = await sealLiveLists(actor);
    return (
      <ActorApiProvider userId={actor.id}>
        <ListApp
          key={actor.id}
          userId={actor.id}
          name={identity.name}
          initialLists={initialLists}
          initialList={initialList}
          initialInvitations={initialInvitations}
          liveConfig={liveConfig}
        />
      </ActorApiProvider>
    );
  } catch (error) {
    if (error instanceof AppError && [429, 503].includes(error.status))
      return (
        <main className="max-w-md mx-auto px-6 py-24">
          <h1 className="text-3xl font-bold mb-4">Paws a moment.</h1>
          <p className="mb-6">{wuffError(error.message)}</p>
          <a href="/lists" className="font-semibold text-primary underline">
            Try again
          </a>
        </main>
      );
    if (error instanceof AppError && error.status === 403)
      return (
        <main className="max-w-md mx-auto px-6 py-24">
          <h1 className="text-3xl font-bold mb-4">
            An invite to the pack is needed.
          </h1>
          <p>
            You’re signed in, but this account hasn’t joined the pack yet. Ask
            the person who invited you to finish setting up your Wuff access.
          </p>
        </main>
      );
    throw error;
  }
}
