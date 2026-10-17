import { redirect } from "next/navigation";
import { pageActor } from "@/lib/auth/server";
import { Connections } from "./connections";
import { mcpResource } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function ConnectionsPage() {
  try {
    await pageActor();
  } catch {
    redirect("/sign-in");
  }
  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <a href="/lists" className="text-primary hover:underline text-sm">
        ← Back to your lists
      </a>
      <h1 className="text-3xl font-bold mt-8 mb-4">Connected AI clients</h1>
      <p className="text-muted-foreground mb-4">
        Give your AI a helping paw. Add this MCP server address in your AI
        client, then sign in and choose its permissions.
      </p>
      <code className="block rounded-xl border border-border p-4 bg-surface break-all text-sm mb-8">
        {mcpResource()}
      </code>
      <Connections />
    </main>
  );
}
