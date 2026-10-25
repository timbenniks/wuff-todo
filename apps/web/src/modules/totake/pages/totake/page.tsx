import type { Metadata } from "next";
import { PortalPage } from "@/components/portal-page";
import { pageActor } from "@/lib/auth/server";
import { getTotake } from "@wuff/domain";
import { TotakeApp } from "@wuff/ui/modules/totake/totake-app";
import "@wuff/ui/modules/totake/totake.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wuff Totake · Wuff Empire" };
async function TotakeContent() {
  const actor = await pageActor();
  return (
    <TotakeApp
      key={actor.id}
      userId={actor.id}
      initial={await getTotake(actor)}
    />
  );
}

export default function TotakePage() {
  return (
    <PortalPage destination="/totake">
      <TotakeContent />
    </PortalPage>
  );
}
