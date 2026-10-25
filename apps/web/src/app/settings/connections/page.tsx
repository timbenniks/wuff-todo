import { Connections } from "../../connections/connections";
import { mcpResource } from "@/lib/config";
import { LegacyConnections } from "./legacy";
export default function ConnectionsPage() {
  return (
    <section>
      <LegacyConnections />
      <h2>AI &amp; MCP connections</h2>
      <p className="settings-description">
        Connect an AI client to Wuff Empire, then choose its permissions. App
        visibility never changes a connection’s access.
      </p>
      <code className="block rounded-xl border border-border p-4 bg-surface break-all text-sm mb-6">
        {mcpResource()}
      </code>
      <p className="settings-note">
        Existing Todo permissions stay limited to Todo. Empire app choices
        require explicit Empire permissions. Future Totake access will require
        separate consent.
      </p>
      <Connections />
      <a className="empire-text-link" href="/settings/todo/github">
        Todo GitHub connections
      </a>
      <a className="empire-text-link" href="/settings/todo/cursor">
        Todo Cursor environments
      </a>
    </section>
  );
}
