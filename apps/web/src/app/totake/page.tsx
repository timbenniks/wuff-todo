import type { Metadata } from "next";
import { Pill, ArrowLeft } from "lucide-react";
import { PortalPage } from "@/components/portal-page";

export const metadata: Metadata = { title: "Wuff Totake · Wuff Empire" };
export const dynamic = "force-dynamic";
export default function TotakePage() {
  return (
    <PortalPage destination="/totake">
      <main id="empire-content" className="empire-page empire-coming-soon">
        <span className="empire-app-icon" aria-hidden="true">
          <Pill size={32} />
        </span>
        <p className="empire-eyebrow">A new member of the pack</p>
        <h1>Wuff Totake</h1>
        <p>A personal home for medicine reminders.</p>
        <p className="empire-coming-note">
          Coming soon. Medicine tracking and reminders aren’t available yet.
        </p>
        <a className="empire-text-link" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to dashboard
        </a>
      </main>
    </PortalPage>
  );
}
