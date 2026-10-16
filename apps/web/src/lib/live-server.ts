import { createRealtime, rawSql } from "@neon/realtime/server";
import type { Actor, ListSummary } from "@wuff/contracts";
import { getLiveQuery } from "@wuff/domain";
import type { LiveLists } from "./live-types";

export async function sealLiveLists(actor: Actor): Promise<LiveLists | null> {
  const secret = process.env.NEON_REALTIME_SECRET;
  const url = process.env.NEON_REALTIME_URL;
  if (!secret || !url) return null;
  const db = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  const realtime = createRealtime({ secret, db });
  const definition = await getLiveQuery(actor);
  return {
    url,
    query: await realtime.seal({
      query: rawSql<ListSummary>(definition.query, definition.params),
    }),
  };
}
