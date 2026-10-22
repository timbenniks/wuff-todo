# Task row spacing

Updated: October 22, 2026

The website task row now uses a shared grid for completion, title and direct actions. Notes, dates, subtask progress and GitHub context start at the title's left edge. Expanded desktop editors use that same column; phone editors keep the full available width. Compact desktop rows use 4px vertical padding and 24px metadata targets, while phone metadata actions retain 44px targets.

GitHub context reads `GitHub #6 · Synced`, with separate issue and sync-control links. The issue and state stay together when metadata wraps. Links underline on hover and retain keyboard focus outlines; attention/disconnected states retain their danger color. Detailed metadata and child-match explanations follow the same desktop alignment and use the full row on phones.

## Local verification

- `pnpm --filter @wuff/web build` passed, including Next.js TypeScript validation.
- Headless Chrome rendered the actual `TaskRow`, editor components, production CSS and DM Sans using a temporary, loopback-only fixture with in-memory task objects. No authenticated API or database writes were performed.
- Measured 1280, 640, 639, 390 and 320px viewports: document width matched viewport width, metadata and title left edges matched, and the action group did not overlap the title column. Compact rows with notes/GitHub measured 77px including their divider on desktop and 97px on phones. Visible phone buttons and metadata links measured at least 44px tall.
- At every width, rename/Escape, date open/cancel, note-editor expansion and nested subtask expansion passed. Expanded notes and subtasks did not introduce document overflow. No browser page errors were captured.
- Visually reviewed desktop and 320px expanded screenshots. `git diff --check` passed.

[Desktop preview](screenshots/task-row-spacing-desktop.png) and [320px expanded preview](screenshots/task-row-spacing-mobile.png) show the synthetic component fixture. This is local UI evidence; production deployment, backend integration, MCP-host and physical-device checks were not run for this spacing change.
