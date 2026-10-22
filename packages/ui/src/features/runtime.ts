"use client";
import { createContext, useContext } from "react";
export type FeatureApi = <T>(
  path: string,
  method?: string,
  body?: unknown,
  userId?: string,
) => Promise<T>;
export type FeatureRuntime = {
  api: FeatureApi;
  signOut: () => Promise<void>;
  reset: () => void;
  navigate: (url: string) => void;
  webOrigin: string;
  native?: boolean;
  githubConsent?: () => Promise<void>;
  image?: (id: string) => Promise<{ url: string; release: () => void }>;
  request: (path: string, init?: RequestInit) => Promise<Response>;
};
export const RuntimeContext = createContext<FeatureRuntime | null>(null);
export function useRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error("Wuff feature runtime is missing");
  return value;
}
