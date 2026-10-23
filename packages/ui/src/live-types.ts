import type { SealedLiveQuery } from "@neon/realtime/client";
import type { ListSummary } from "@wuff/contracts";

export type LiveLists = {
  url: string;
  query: SealedLiveQuery<ListSummary>;
};
