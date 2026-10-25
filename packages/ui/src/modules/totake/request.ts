import type { TotakeSnapshot } from "@wuff/contracts";
export function acceptTotakeRead(
  current: Pick<TotakeSnapshot, "userId" | "version">,
  incoming: Pick<TotakeSnapshot, "userId" | "version">,
) {
  return (
    incoming.userId === current.userId && incoming.version >= current.version
  );
}

/** Explicit conflict recovery outranks periodic/focus reads. Saves invalidate all older reads. */
export function createTotakeReadGate() {
  let generation = 0,
    priority: number | null = null;
  return {
    begin(explicit = false) {
      if (!explicit && priority !== null) return null;
      const ticket = ++generation;
      if (explicit) priority = ticket;
      return ticket;
    },
    current(ticket: number) {
      return ticket === generation;
    },
    finish(ticket: number) {
      if (priority === ticket) priority = null;
    },
    invalidate() {
      generation++;
      priority = null;
    },
  };
}
