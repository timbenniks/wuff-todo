import type { TotakeSnapshot } from "@wuff/contracts";
export function acceptTotakeRead(
  current: Pick<TotakeSnapshot, "userId" | "version">,
  incoming: Pick<TotakeSnapshot, "userId" | "version">,
) {
  return (
    incoming.userId === current.userId && incoming.version >= current.version
  );
}
