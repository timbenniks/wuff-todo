"use client";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { disableBrowserOnSignOut } from "@/lib/reminder-browser";
import { authClient } from "@/lib/auth/client";
import {
  EmpireActor,
  useEmpirePreferences,
} from "@/components/empire-preferences";
import { clearAfterEmpireSignOut } from "@/lib/empire-preferences-store";
import { RuntimeContext, type FeatureRuntime } from "@wuff/ui/features/runtime";
export { useActorApi } from "@wuff/ui/features/actor-api";
export function ActorApiProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const { clear } = useEmpirePreferences();
  const runtime = useMemo<FeatureRuntime>(
    () => ({
      api: (path, method, body) => api(path, method, body, userId),
      signOut: async () => {
        await disableBrowserOnSignOut();
        await clearAfterEmpireSignOut(() => authClient.signOut(), clear);
        window.location.assign("/sign-in");
      },
      navigate: (url) => window.location.assign(url),
      reset: () => window.location.replace("/lists"),
      webOrigin: typeof window === "undefined" ? "" : window.location.origin,
      request: (path, init) =>
        fetch(path, {
          ...init,
          headers: { ...init?.headers, "X-Wuff-User": userId },
        }),
    }),
    [userId, clear],
  );
  return (
    <RuntimeContext.Provider value={runtime}>
      <EmpireActor userId={userId} />
      {children}
    </RuntimeContext.Provider>
  );
}
