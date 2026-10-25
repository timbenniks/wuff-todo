import { pageActor } from "@/lib/auth/server";
import { getTotake } from "@wuff/domain";
import { TotakeApp } from "@wuff/ui/modules/totake/totake-app";
import "@wuff/ui/modules/totake/totake.css";
export default async function TotakeSettingsPage() {
  const actor = await pageActor();
  return (
    <TotakeApp
      key={actor.id}
      userId={actor.id}
      initial={await getTotake(actor)}
      initialPage="settings"
    />
  );
}
