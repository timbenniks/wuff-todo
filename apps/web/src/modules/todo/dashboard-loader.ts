import type { Dashboard } from "@wuff/contracts";

export type PortalDashboardState =
  | { status: "loading"; data: null }
  | { status: "ready"; data: Dashboard }
  | { status: "error"; data: null };

// Last-request-wins also prevents an old account/date response restoring a preview.
export function portalDashboardLoader(
  read: (today: string) => Promise<Dashboard>,
  publish: (state: PortalDashboardState) => void,
) {
  let epoch = 0;
  let disposed = false;
  let state: PortalDashboardState = { status: "loading", data: null };
  function update(next: PortalDashboardState) {
    state = next;
    publish(next);
  }
  return {
    async refresh(today: string) {
      if (disposed) return;
      const request = ++epoch;
      if (state.status !== "ready" || state.data.today !== today)
        update({ status: "loading", data: null });
      try {
        const data = await read(today);
        if (!disposed && request === epoch) update({ status: "ready", data });
      } catch {
        if (!disposed && request === epoch)
          update({ status: "error", data: null });
      }
    },
    dispose() {
      disposed = true;
      epoch++;
    },
  };
}
