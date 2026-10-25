import { safeNotificationPath } from "@wuff/contracts/modules/totake/notification";
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

export default async function TotakePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value))
      for (const part of value) params.append(key, part);
  }
  const candidate = safeNotificationPath(`/totake?${params}`);
  const returnPath = candidate.startsWith("/totake?") ? candidate : "/totake";
  return (
    <PortalPage destination="/totake" returnPath={returnPath}>
      <TotakeContent />
    </PortalPage>
  );
}
