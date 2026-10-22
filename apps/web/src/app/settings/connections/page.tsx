import { redirect } from "next/navigation";
import { pageActor } from "@/lib/auth/server";
import { getList, listLists } from "@wuff/domain";
import { AgentSettings } from "../../agents/settings";
import { Connections } from "../../connections/connections";
import { mcpResource } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string }>;
}) {
  let actor;
  try {
    actor = await pageActor();
  } catch {
    redirect("/sign-in");
  }
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
    <section>
      <h2 className="text-2xl font-bold mb-4">Connections</h2>
      <p className="text-muted-foreground mb-4">
        Give your AI a helping paw. Add this MCP server address in your AI
        client, then sign in and choose its permissions.
      </p>
      <code className="block rounded-xl border border-border p-4 bg-surface break-all text-sm mb-8">
        {mcpResource()}
      </code>
      <h2 className="text-xl font-bold mb-3">Connected AI clients</h2>
      <Connections />
      <a href="/github" className="block mt-6 text-primary underline">
        Manage GitHub connections
      </a>
      <section id="cursor" className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-bold mb-3">Cursor environments</h2>
        <p className="text-muted-foreground mb-4">
          Give each Work list a development environment. Keep production
          credentials out of coding environments.
        </p>
        <AgentSettings
          lists={lists}
          userId={actor.id}
          initialId={(await searchParams).listId}
        />
      </section>
    </section>
  );
}
