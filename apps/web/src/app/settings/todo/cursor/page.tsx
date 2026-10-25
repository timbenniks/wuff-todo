import { pageActor } from "@/lib/auth/server";
import { getList, listLists } from "@wuff/domain";
import { AgentSettings } from "../../../agents/settings";
export default async function CursorPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  const actor = await pageActor();
  const owned = (await listLists(actor)).filter(
    (l) => l.ownerId === actor.id && !l.archived,
  );
  const work = await Promise.all(
    owned.map(async (l) => ({
      summary: l,
      mode: (await getList(actor, l.id)).mode,
    })),
  );
  const lists = work.filter((l) => l.mode === "work").map((l) => l.summary);
  return (
    <section id="cursor">
      <h2>Cursor environments</h2>
      <p className="settings-description">
        Personal coding connections and environments for your Work lists.
      </p>
      <AgentSettings
        lists={lists}
        userId={actor.id}
        initialId={(await searchParams).listId}
      />
    </section>
  );
}
