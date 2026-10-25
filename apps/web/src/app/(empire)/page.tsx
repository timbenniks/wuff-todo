import { EmpireDashboard } from "@/components/empire-dashboard";
import { PortalPage } from "@/components/portal-page";

export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <PortalPage destination="/">
      <EmpireDashboard />
    </PortalPage>
  );
}
