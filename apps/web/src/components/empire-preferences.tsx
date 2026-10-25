"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EmpireSettings } from "@wuff/contracts";
import { api } from "@/lib/api";

type PreferencesContext = {
  settings: EmpireSettings | null;
  error: string;
  register: (userId: string) => void;
  refresh: () => Promise<void>;
  accept: (settings: EmpireSettings) => void;
};
const Context = createContext<PreferencesContext | null>(null);
export function EmpirePreferencesProvider({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [settings, setSettings] = useState<EmpireSettings | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const register = useCallback((id: string) => setUserId(id), []);
  const accept = useCallback(
    (next: EmpireSettings) => {
      if (next.userId !== userId) return;
      generation.current++;
      setSettings((old) => (old && old.version > next.version ? old : next));
      setError("");
    },
    [userId],
  );
  const refresh = useCallback(async () => {
    if (!userId || !active) return;
    const request = ++generation.current;
    try {
      const next = await api<EmpireSettings>(
        "/api/v1/empire",
        "GET",
        undefined,
        userId,
      );
      if (request === generation.current) accept(next);
    } catch {
      if (request === generation.current) {
        setError("We couldn’t load your Empire settings. Try again.");
      }
    }
  }, [userId, accept, active]);
  useEffect(() => {
    setSettings(null);
    setError("");
    if (!active) {
      setUserId("");
      return;
    }
    const read = () => {
      if (!document.hidden) void refresh();
    };
    read();
    const timer = window.setInterval(read, 10_000);
    window.addEventListener("focus", read);
    window.addEventListener("online", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", read);
      window.removeEventListener("online", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, [refresh, active]);
  const value = useMemo(
    () => ({
      settings: settings?.userId === userId ? settings : null,
      error,
      register,
      refresh,
      accept,
    }),
    [settings, userId, error, register, refresh, accept],
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
  useEffect(() => {
    register?.(userId);
  }, [register, userId]);
  return null;
}
