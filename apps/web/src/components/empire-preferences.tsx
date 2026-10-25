"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { EmpireSettings } from "@wuff/contracts";
import { api } from "@/lib/api";
import {
  createEmpirePreferencesStore,
  type EmpireBootstrap,
} from "@/lib/empire-preferences-store";

type PreferencesContext = {
  settings: EmpireSettings | null;
  name: string;
  error: string;
  register: (userId: string) => void;
  refresh: () => Promise<void>;
  accept: (settings: EmpireSettings) => void;
  clear: () => void;
};
const Context = createContext<PreferencesContext | null>(null);
export function EmpirePreferencesProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: EmpireBootstrap | null;
}) {
  const [store] = useState(() =>
    createEmpirePreferencesStore(initial, (userId) =>
      api<EmpireSettings>("/api/v1/empire", "GET", undefined, userId),
    ),
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const register = useCallback(
    (userId: string) => {
      if (store.register(userId)) window.location.reload();
    },
    [store],
  );
  useEffect(() => {
    const read = () => {
      if (!document.hidden) void store.refresh();
    };
    if (!store.getSnapshot().settings) read();
    const timer = window.setInterval(read, 10_000);
    window.addEventListener("focus", read);
    window.addEventListener("online", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      store.cancelPending();
      window.clearInterval(timer);
      window.removeEventListener("focus", read);
      window.removeEventListener("online", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, [store]);
  const value = useMemo(
    () => ({
      settings: snapshot.settings,
      name: snapshot.name,
      error: snapshot.error,
      register,
      refresh: store.refresh,
      accept: store.accept,
      clear: store.clear,
    }),
    [snapshot, register, store],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useEmpirePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("Empire preferences provider is missing");
  return value;
}
export function EmpireActor({ userId }: { userId: string }) {
  const value = useContext(Context);
  const register = value?.register;
  useLayoutEffect(() => {
    register?.(userId);
  }, [register, userId]);
  return null;
}
