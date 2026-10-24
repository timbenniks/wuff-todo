import { DocsControls } from "../../docs/controls";
import "../../docs/docs.css";
export default function SettingsDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="settings-guide" aria-label="Implementation guide">
      <h2 className="text-xl font-bold">Implementation guide</h2>
      <DocsControls basePath="/settings/docs" />
      <div className="docs-main" id="guide-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="docs-footer">
        <a href="/docs/agent-context.md">Plain-text reference for your agent</a>
      </footer>
    </section>
  );
}
