import { ActorApiProvider } from "../lists/actor-api";
import { ListApp } from "../lists/list-app";
import { SettingsNav } from "./settings-nav";
import { pageActor, webIdentity } from "@/lib/auth/server";
import { listLists, listInvitations } from "@wuff/domain";
import { sealLiveLists } from "@/lib/live-server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await pageActor();
  } catch {
    redirect("/sign-in");
  }
  const [identity, initialLists, initialInvitations, liveConfig] =
    await Promise.all([
      webIdentity(),
      listLists(actor),
      listInvitations(actor),
      sealLiveLists(actor),
    ]);
  return (
    <ActorApiProvider userId={actor.id}>
      <ListApp
        key={actor.id}
        userId={actor.id}
        name={identity?.name ?? "Your account"}
        initialLists={initialLists}
        initialList={null}
        initialInvitations={initialInvitations}
        liveConfig={liveConfig}
        workspace={{
          navigation: <SettingsNav />,
          content: (
            <>
              <header className="list-heading">
                <h1 className="font-bold">Settings</h1>
              </header>
              <div className="settings-content">{children}</div>
            </>
          ),
        }}
      />
    </ActorApiProvider>
  );
}
