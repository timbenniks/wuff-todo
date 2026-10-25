import type { EmpireSettings } from "@wuff/contracts";

export type EmpireBootstrap = {
  userId: string;
  name: string;
  settings: EmpireSettings | null;
};
export async function clearAfterEmpireSignOut(
  signOut: () => Promise<{ error?: unknown }>,
  clear: () => void,
) {
  const result = await signOut();
  if (result.error) throw new Error("Sign-out failed");
  clear();
}
export function createEmpirePreferencesStore(
  initial: EmpireBootstrap | null,
  read: (userId: string) => Promise<EmpireSettings>,
) {
  let state = {
    userId: initial?.userId ?? "",
    name: initial?.name ?? "",
    settings:
      initial?.settings?.userId === initial?.userId
        ? (initial?.settings ?? null)
        : null,
    error: "",
  };
  let generation = 0;
  const listeners = new Set<() => void>();
  function publish(next: typeof state) {
    state = next;
    for (const listener of listeners) listener();
  }
  const clear = (error = "") => {
    generation++;
    publish({ userId: "", name: "", settings: null, error });
  };
  const accept = (next: EmpireSettings) => {
    if (!state.userId || next.userId !== state.userId) return;
    if (state.settings && next.version < state.settings.version) return;
    generation++;
    publish({ ...state, settings: next, error: "" });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register(userId: string) {
      if (userId === state.userId) return false;
      clear("Your account changed. Reload Wuff to continue.");
      return true;
    },
    clear,
    accept,
    cancelPending() {
      generation++;
    },
    async refresh() {
      const userId = state.userId;
      if (!userId) return;
      const request = ++generation;
      try {
        const next = await read(userId);
        if (request !== generation || state.userId !== userId) return;
        if (next.userId !== userId) {
          clear("Your account changed. Reload Wuff to continue.");
          return;
        }
        accept(next);
      } catch (error) {
        if (request !== generation || state.userId !== userId) return;
        const status = (error as { status?: number } | null)?.status;
        if (status && [401, 403, 409].includes(status)) {
          clear("Your session changed. Reload Wuff to continue.");
        } else {
          publish({
            ...state,
            error: "We couldn’t refresh your Empire settings. Try again.",
          });
        }
      }
    },
  };
}
