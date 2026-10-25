import { pageActor } from "@/lib/auth/server";
import { listLists } from "@wuff/domain";
import { GithubConnections } from "../../../github/connections";
export default async function GithubSettings({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string; error?: string }>;
}) {
  const actor = await pageActor();
  const params = await searchParams;
  const lists = (await listLists(actor)).filter(
    (list) => list.ownerId === actor.id && !list.archived,
  );
  return (
    <section>
      <h2>GitHub connections</h2>
      <p className="settings-description">
        Connect a repository to a Todo Work list. Connections are personal; only
        the list owner manages its binding.
      </p>
      {params.error && (
        <p role="alert">
          GitHub authorization could not be verified. Connect again.
        </p>
      )}
      <GithubConnections
        lists={lists}
        initialId={params.listId}
        userId={actor.id}
      />
    </section>
  );
}
