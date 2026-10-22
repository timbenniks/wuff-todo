"use client";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth/client";
import { RuntimeContext, type FeatureRuntime } from "@wuff/ui/features/runtime";
export { useActorApi } from "@wuff/ui/features/actor-api";
export function ActorApiProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const runtime = useMemo<FeatureRuntime>(
    () => ({
      api: (path, method, body) => api(path, method, body, userId),
      signOut: async () => {
        await authClient.signOut();
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
    [userId],
  );
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
