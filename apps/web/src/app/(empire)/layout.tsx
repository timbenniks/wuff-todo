import { AppError } from "@wuff/contracts";
import { getEmpireSettings } from "@wuff/domain";
import { EmpireFrame } from "@/components/empire-frame";
import { pageActor, webIdentity } from "@/lib/auth/server";
import type { EmpireBootstrap } from "@/lib/empire-preferences-store";

export const dynamic = "force-dynamic";
export default async function EmpireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initial: EmpireBootstrap | null = null;
  try {
    const actor = await pageActor();
    const identity = await webIdentity();
    initial = {
      userId: actor.id,
      name: identity?.name ?? "Account",
      settings: null,
    };
    try {
      initial.settings = await getEmpireSettings(actor);
    } catch {
      // A temporary preferences failure must not replace page-level auth handling.
      // The account-pinned client refresh can recover without a fabricated menu.
    }
  } catch (error) {
    if (!(
      error instanceof AppError &&
      [401, 403, 409, 429, 503].includes(error.status)
    ))
      throw error;
    // Existing pages retain their redirect/admission/retry responses.
  }
  return (
    <EmpireFrame key={initial?.userId ?? "anonymous"} initial={initial}>
      {children}
    </EmpireFrame>
  );
}
