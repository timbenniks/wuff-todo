# Hosted design guide and prototype skill

October 23, 2026. The selected contributor workflow is ChatGPT Work in a shared
workspace, with URLs and no local checkout for the designer. The hosted guide at
`/docs` is the entry point. It covers current product/permission rules, real UI
primitives and feature components, design choices, palettes, responsive and
accessibility expectations, cloud prototyping and a self-contained task handoff.

## Source and delivery

- Human pages are static, public and use real `@wuff/ui` controls. No session or
  application-data reads occur. Settings links to the guide. Public guide access
  does not change invite-only application admission or API permissions.
- `/docs/agent-context.md` serves the same reviewed content plus exact generated
  component signatures as Markdown. No client-side rendering is required to read it.
- `docs/prototyping/*.md` are the maintained content sources.
  `docs/prototyping/skill` is the canonical portable skill. It routes to living URLs,
  supports a plain-instruction fallback, requires explicit task handoff intent and
  grants no publishing, account, paid-run or production privileges.
- `pnpm build:prototype` runs before development/build. It regenerates the page data,
  palette table, 41-component inventory and public downloads from the current source.
  The inventory is derived from exported React function declarations, including named
  re-exports. Helpers, types, CSS and runtime interfaces are included in source.
- The standalone kit uses Vite/React/TypeScript/Tailwind with original UI, design,
  contracts and client package source. Base dependency versions are matched to the
  installed app; the kit has its own frozen lockfile. Refresh that lockfile when
  package/dependency changes require it and repeat the standalone checks.
- The archive includes original upright/italic DM Sans plus OFL, Waffles, exact source
  hashes, a runtime mock and an interactive real TaskRow. Full feature components
  need their appropriate local runtime/callbacks. Unsupported integrations visibly
  fail as unsimulated; no success or real backend connection is invented.
- Packaging is allowlisted. Server/domain/database packages, environment files,
  credentials, real-user lists/images and native plugins are excluded. ZIPs are built
  in Node without a platform archiver and served from `/prototype-kit/`; generated
  downloads are ignored in Git. `sourceCommit` may be null in builds without Git
  metadata; per-file hashes remain authoritative and include working-tree inputs.

## Verification

- `pnpm check`: all 84 unit tests, workspace/root TypeScript, optimized web/MCP build
  passed. Final public-guide/kit edits were additionally built and typechecked by the
  optimized build. No backend behavior, schema or OAuth contract changed.
- Extracted the generated ZIP outside the monorepo, installed with its frozen
  lockfile and built its TypeScript/Vite app successfully. The Vite chunk-size
  advisory reflects the real task/rich-editor code; it is not a build failure.
- Independent Python ZIP/CRC/SHA checks verified all 83 input hashes and byte-for-byte
  package source fidelity, with no environment files or server packages.
- Canonical and installed skill passed the skill-creator validator.
- `node scripts/verify-prototype-guide.mjs` against the local production build and
  standalone preview checked all seven unauthenticated pages at 320/390/1280px,
  no document overflow, raw reference and all downloads, real field/button feedback,
  44px grouped action, Rose palette, actual task completion, embedded theme isolation,
  standalone creation/palette changes, zero browser exceptions and no Wuff API calls.
  The script requires local web port 3000 and extracted kit preview port 4173; it does
  not create production data or authenticate. Screenshots were visually inspected.
- A fresh phone screenshot navigation avoids a Chrome full-page raster artifact seen
  immediately after resizing the desktop page; DOM structure and measured layout were
  correct. The stored phone evidence is from the fresh navigation.
- Screenshot evidence: [guide desktop](screenshots/prototype-guide-1280.png),
  [guide phone](screenshots/prototype-guide-390.png),
  [component examples](screenshots/prototype-components-390.png).
- This is browser/standalone evidence, not physical-device, screen-reader conformance
  or an actual ChatGPT Work cloud-builder run. Hosting/plugin availability and skill
  installation in her own workspace remain to be exercised there.
