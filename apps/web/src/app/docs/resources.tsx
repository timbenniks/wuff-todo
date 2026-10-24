"use client";
import { useEffect, useState } from "react";
const starter =
  "Read https://wuff-todo.vercel.app/docs/agent-context.md. Help me explore a Wuff Todo feature. Use Wuff’s actual components and design tokens from the prototype kit and show a working prototype. Iterate with me before preparing a specification. Do not create a Wuff task until I ask for a handoff.";
export function GuideResources() {
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/prototype-kit/source-manifest.json")
      .then((r) => r.json())
      .then((m) => {
        if (active) setRevision(m.sourceCommit);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <aside
      className="docs-downloads docs-quick-start"
      aria-label="Prototype resources"
    >
      <h2>Start with the real Wuff kit</h2>
      <div>
        <a
          className="wuff-button"
          data-variant="primary"
          href="/prototype-kit/wuff-prototype.zip"
          download
        >
          Download prototype kit
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
          href="/prototype-kit/feature-brief.md"
          download
        >
          Feature brief template
        </a>
      </div>
      <details>
        <summary>Starter prompt and extra resources</summary>
        <p className="select-text">{starter}</p>
        <div>
          <a href="/prototype-kit/wuff-prototype-skill.zip" download>
            Download skill
          </a>
          <a href="/prototype-kit/SKILL.md">Read skill instructions</a>
          <a href="/docs/agent-context.md">Agent reference</a>
        </div>
      </details>
      <p className="docs-caption">
        Source base {revision ? revision.slice(0, 12) : "recorded in manifest"}{" "}
        ·{" "}
        <a href="/prototype-kit/source-manifest.json">
          Exact build input hashes
        </a>
        . Hashes include any changes made after the source base.
      </p>
      {status && <p role="status">{status}</p>}
    </aside>
  );
}
