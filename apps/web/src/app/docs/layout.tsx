import Link from "next/link";
import type { Metadata } from "next";
import { Corgi } from "@wuff/ui/features/components/corgi";
import { DocsControls } from "./controls";
import "./docs.css";

export const metadata: Metadata = {
  title: "Implementation guide · Wuff Todo",
  description:
    "Implement Wuff features with its real components, product rules, approved scope and verified PR workflow.",
};
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-shell">
      <a className="docs-skip" href="#guide-content">
        Skip to guide
      </a>
      <header className="docs-header">
        <Link
          href="/lists?home=1"
          aria-label="Wuff Todo Home"
          className="docs-brand"
        >
          <Corgi size={44} />
          <span>
            Wuff Todo
            <span className="docs-caption">Implementation guide</span>
          </span>
        </Link>
        <Link className="docs-app-link" href="/lists">
          Open Wuff <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <DocsControls />
      <div className="docs-main" id="guide-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="docs-footer">
        A shared language for your next idea.{" "}
        <a href="/docs/agent-context.md">Plain-text reference for your agent</a>
      </footer>
    </div>
  );
}
