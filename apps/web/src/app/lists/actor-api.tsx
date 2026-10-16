"use client";
import { createContext, useContext, useMemo } from "react";
import { api } from "@/lib/api";
const ActorContext = createContext<string | undefined>(undefined);
export function ActorApiProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <ActorContext.Provider value={userId}>{children}</ActorContext.Provider>
  );
}
export function useActorApi() {
  const userId = useContext(ActorContext);
  return useMemo(
    () =>
      <T,>(path: string, method = "GET", body?: unknown) =>
        api<T>(path, method, body, userId),
    [userId],
  );
}
