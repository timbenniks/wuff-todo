import { ImagePool, privateImageBlob } from "./image-pool";
import { useMemo, useState, useEffect, type MouseEvent } from "react";
import { ListApp } from "@wuff/ui/modules/todo/app/lists/list-app";
import { RuntimeContext, type FeatureRuntime } from "@wuff/ui/features/runtime";
import type {
  ListSummary,
  TodoList,
  IncomingInvitation,
} from "@wuff/contracts";
import type { LiveLists } from "@wuff/ui/live-types";
import { openUrl } from "@tauri-apps/plugin-opener";
import { client } from "./session";
import { featureApi } from "./feature-api";
export type WorkspaceData = {
  userId: string;
  scopes: string[];
  initialLists: ListSummary[];
  initialList: TodoList | null;
  initialInvitations: IncomingInvitation[];
  liveConfig: LiveLists | null;
};
export async function loadWorkspace(): Promise<WorkspaceData> {
  const session = await client.call<{ userId: string; scopes: string[] }>(
    "session",
  );
  const [initialLists, initialInvitations, liveConfig] = await Promise.all([
    client.lists(),
    client.call<IncomingInvitation[]>("listInvitations"),
    client
      .call<LiveLists>("getLive", { userId: session.userId })
      .catch(() => null),
  ]);
  const initialList = null;
  return {
    ...session,
    initialLists,
    initialInvitations,
    initialList,
    liveConfig,
  };
}
export function Workspace({
  data,
  onSignOut,
  onError,
  onGithubConsent,
  sessionError,
}: {
  data: WorkspaceData;
  onSignOut: () => Promise<void>;
  onError: (error: unknown) => void;
  onGithubConsent: () => Promise<void>;
  sessionError: string;
}) {
  const [pool] = useState(
    () =>
      new ImagePool(async (id) => {
        const response = await client.image(
          new URLSearchParams({ id }),
          {},
          data.userId,
        );
        return privateImageBlob(response);
      }),
  );
  useEffect(() => () => pool.clear(), [pool]);
  const runtime = useMemo<FeatureRuntime>(
    () => ({
      api: featureApi(client, data.userId),
      signOut: onSignOut,
      reset: () => {
        void client.clear().catch(onError);
      },
      webOrigin: client.origin,
      native: true,
      githubConsent: data.scopes.includes("github:manage")
        ? undefined
        : onGithubConsent,
      request: async (path, init) => {
        const url = new URL(path, client.origin);
        if (
          url.origin !== client.origin ||
          url.pathname !== "/api/v1/attachments"
        )
          throw new Error("Unsupported image request.");
        return client.image(url.searchParams, init, data.userId);
      },
      image: (id) => pool.acquire(id),
      navigate: (url) => {
        void openUrl(url);
      },
    }),
    [data.userId, data.scopes, pool, onSignOut, onError, onGithubConsent],
  );
  function openLink(event: MouseEvent) {
    const anchor = (event.target as Element).closest("a");
    if (!anchor || event.defaultPrevented) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    event.preventDefault();
    const url = new URL(href, client.origin);
    if (["https:", "http:", "mailto:"].includes(url.protocol))
      void openUrl(url.href).catch(() => {});
  }
  return (
    <RuntimeContext.Provider value={runtime}>
      <div onClick={openLink} className="native-workspace">
        {sessionError && (
          <p
            role="alert"
            className="m-4 p-4 rounded-xl bg-danger/10 text-danger"
          >
            {sessionError}
          </p>
        )}
        <ListApp {...data} name="Your pack" />
      </div>
    </RuntimeContext.Provider>
  );
}
