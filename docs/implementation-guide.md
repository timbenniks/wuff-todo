# Contributor implementation guide

October 24, 2026. Contributors now implement features in the actual repository.
The standalone prototype workflow and design-to-Tim handoff are retired. The
product/design/accessibility rules, component examples, early iteration and
decision/acceptance records are incorporated into one contributor workflow.

## Instruction hierarchy

- Root and nearby AGENTS.md are the repository entry points and architectural
  boundaries. Root instructions route agents to the canonical contributor workflow.
- `docs/guide/` maintains product, design, component, accessibility, build and
  review guidance, including mandatory API/MCP/connection surface contracts.
  `/docs` and authenticated `/settings/docs` render the same
  content. `docs/contributor-workflow.md` is included in the Build page.
- `.agents/skills/wuff-contributor/SKILL.md` applies those rules to discovery,
  scoped implementation, iteration, evidence and PR delivery. It does not duplicate
  the full guide or grant execution privileges.
- GitHub permissions, scope/evidence checks and Tim's review control integration.
  [Activation and environment gates](contributor-github.md) remain separate.

## Generation and downloads

The API/MCP/connections page makes every persisted mutation, MCP UI decision,
connection consent/revocation/privacy impact and cross-surface test plan explicit.
Its scope fields are bound to Tim's approval; web-only writes cannot be complete.

`pnpm build:guide` runs before web development/build. It reads the maintained
Markdown, palette source and actual `packages/ui/src` exports. The generated
component inventory includes signatures and repository source paths. Nothing is
copied into a standalone application, and no dependency-version resolution or
prototype lockfile is maintained.

`/contributor-kit/` serves the contributor skill, workflow, brief/PR templates,
component inventory and SHA-256 manifest of those exact downloads. Its ZIP contains
only the contributor skill, never application source, server packages, environments
or credentials. The guide examples import real components with synthetic data and
local runtime stubs; they are reference examples, not connected feature proof.

Old `/docs/prototyping` and `/docs/handoff` URLs redirect permanently to Build and
Review. Authenticated aliases stay under `/settings/docs`. Old `/prototype-kit/*`
URLs return HTTP 410 with an explicit retirement message. The build removes old
generated archives so a stale local public directory cannot keep serving them.
The canonical prototype skill and `tools/prototype-kit` source are removed;
Git history and [historical verification](prototype-guide.md) preserve prior work.

## Verification boundary

See [current evidence](verification.md#implementation-guide-consolidation--october-24-2026).
No domain/API/schema behavior, admission model, migration or production setting
changes. This guide does not provision a safe workspace or isolate a preview.
