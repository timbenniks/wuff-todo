"use client";
import { useState } from "react";
const starter =
  "Use the wuff-contributor skill. Read AGENTS.md and docs/contributor-workflow.md in this repository, plus the product, design, component and accessibility guide. Help me define a feature brief and acceptance criteria, create a codex/ branch and draft PR, and request Tim's scope approval before implementation. Reuse Wuff's actual components and tokens, show the main interaction early and iterate with me. Handle Git and verification for me. Add meaningful unit tests for changed behavior and regression tests for fixes. Preserve permissions, personal/shared boundaries and save recovery. Map every persisted mutation to API and MCP equivalents, assess MCP UI, and preserve connection scopes, consent and revocation. Use synthetic data and only a confirmed isolated preview backend. Keep decisions, current-commit evidence and remaining gaps in the PR. Do not merge or release. My idea is:";
export function GuideResources() {
  const [status, setStatus] = useState("");
  return (
    <aside
      className="docs-downloads docs-quick-start"
      aria-label="Contributor resources"
    >
      <h2>Start in your contributor workspace</h2>
      <div>
        <a
          className="wuff-button"
          data-variant="primary"
          href="/contributor-kit/wuff-contributor-skill.zip"
          download
        >
          Download contributor skill
        </a>
        <button
          className="wuff-button"
          data-variant="outline"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(starter);
              setStatus("Starter prompt copied.");
            } catch {
              setStatus(
                "Copy isn’t available here. Select the starter prompt below.",
              );
            }
          }}
        >
          Copy starter prompt
        </button>
        <a
          className="wuff-button"
          data-variant="outline"
          href="/contributor-kit/contributor-pr-template.md"
          download
        >
          PR brief template
        </a>
      </div>
      <details>
        <summary>Starter prompt and agent resources</summary>
        <p className="select-text">{starter}</p>
        <div>
          <a href="/contributor-kit/contributor-workflow.md" download>
            Download full workflow
          </a>
          {" · "}
          <a href="/contributor-kit/SKILL.md">Read skill instructions</a>
          {" · "}
          <a href="/docs/agent-context.md">Agent reference</a>
          {" · "}
          <a href="/contributor-kit/source-manifest.json">Download hashes</a>
        </div>
      </details>
      <p className="docs-caption">
        Use the rules in your current repository checkout. Hosted downloads may
        lag unmerged changes.
      </p>
      {status && <p role="status">{status}</p>}
    </aside>
  );
}
