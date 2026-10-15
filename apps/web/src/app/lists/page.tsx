import { redirect } from "next/navigation";
import { webActor, webIdentity } from "@/lib/auth/server";
import { AppError } from "@wuff/contracts";
import type { TodoList } from "@wuff/contracts";
import { getList, listLists } from "@wuff/domain";
import { ListApp } from "./list-app";
export const dynamic = "force-dynamic";
export default async function ListsPage() {
  const identity = await webIdentity();
  if (!identity) redirect("/sign-in");
  try {
    const actor = await webActor();
    const initialLists = await listLists(actor);
    let initialList: TodoList | null = null;
    if (initialLists[0]) {
      try {
        initialList = await getList(actor, initialLists[0].id);
      } catch (error) {
        // A concurrent delete/revocation is reconciled by the client's fresh read.
        if (!(error instanceof AppError && error.status === 404)) throw error;
      }
    }
    return (
      <ListApp
        key={actor.id}
        userId={actor.id}
        name={identity.name}
        initialLists={initialLists}
        initialList={initialList}
      />
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 403)
      return (
        <main className="max-w-md mx-auto px-6 py-24">
          <h1 className="text-3xl font-bold mb-4">An invitation is needed.</h1>
          <p>
            Your identity is signed in, but this account hasn’t been invited to
            Wuff yet. Ask the person who invited you to finish setting up your
            access.
          </p>
        </main>
      );
    throw error;
  }
}
