import { PortalPage } from "@/components/portal-page";
import { SettingsNav } from "./settings-nav";
export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Wuff Empire" };
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalPage destination="/settings">
      <div className="empire-settings-shell">
        <SettingsNav />
        <main className="empire-settings-content" id="empire-settings-content">
          <p className="empire-eyebrow">Wuff Empire</p>
          <h1>Settings</h1>
          {children}
        </main>
      </div>
    </PortalPage>
  );
}
