"use client";
import { useEffect, useState } from "react";
const prototypeStarter =
  "Read https://wuff-todo.vercel.app/docs/agent-context.md. Help me explore a Wuff Todo feature. Use Wuff’s actual components and design tokens from the prototype kit and show a working prototype. Iterate with me before preparing a specification. Do not create a Wuff task until I ask for a handoff.";
export function GuideResources({
  contributor = false,
}: {
  contributor?: boolean;
}) {
  const starter = contributor
    ? "Use the wuff-contributor skill. Read AGENTS.md and docs/contributor-workflow.md in this repository. Help me define a feature brief and acceptance criteria, create a codex/ branch and draft PR, and request Tim's scope approval before implementation. Handle Git and verification for me. Preserve Wuff's components and permission/retry behavior. Use only an isolated preview backend and synthetic data. Keep current-commit evidence and remaining gaps in the PR. Do not merge or release. My idea is:"
    : prototypeStarter;
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
      aria-label={contributor ? "Contributor resources" : "Prototype resources"}
    >
      <h2>
        {contributor
          ? "Start in your contributor workspace"
          : "Start with the real Wuff kit"}
      </h2>
      <div>
        <a
          className="wuff-button"
          data-variant="primary"
          href={
            contributor
              ? "/prototype-kit/wuff-contributor-skill.zip"
              : "/prototype-kit/wuff-prototype.zip"
          }
          download
        >
          {contributor
            ? "Download contributor skill"
            : "Download prototype kit"}
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
          href={
            contributor
              ? "/prototype-kit/contributor-pr-template.md"
              : "/prototype-kit/feature-brief.md"
          }
          download
        >
          {contributor ? "PR brief template" : "Feature brief template"}
        </a>
      </div>
      <details>
        <summary>Starter prompt and extra resources</summary>
        <p className="select-text">{starter}</p>
        <div>
          <a
            href={
              contributor
                ? "/prototype-kit/contributor-workflow.md"
                : "/prototype-kit/wuff-prototype-skill.zip"
            }
            download
          >
            {contributor ? "Download full workflow" : "Download skill"}
          </a>
          <a
            href={
              contributor
                ? "/prototype-kit/CONTRIBUTOR-SKILL.md"
                : "/prototype-kit/SKILL.md"
            }
          >
            Read skill instructions
          </a>
          <a href="/docs/agent-context.md">Agent reference</a>
        </div>
      </details>
      {contributor ? (
        <p className="docs-caption">
          Use the rules in your current repository checkout. Hosted downloads
          may lag unmerged changes.
        </p>
      ) : (
        <p className="docs-caption">
          Source base{" "}
          {revision ? revision.slice(0, 12) : "recorded in manifest"} ·{" "}
          <a href="/prototype-kit/source-manifest.json">
            Exact build input hashes
          </a>
          . Hashes include any changes made after the source base.
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </aside>
  );
}
