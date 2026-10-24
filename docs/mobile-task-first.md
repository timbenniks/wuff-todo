# Task-first list workspace

October 24, 2026. Local implementation; production release pending.

## Design plan and decisions

The phone list should open on tasks, with management available on demand. Retain the existing list-driven palette, DM Sans and shared 44px controls. The compact title bar is the visual anchor; task content carries the rest of the screen.

- Replace the large list card with a 56px phone / 60px desktop sticky title bar. Long names truncate visually while retaining the full accessible heading and title. The settings cog remains reachable while scrolling.
- List settings is the single entrypoint for list name, description, type, color, sharing/people, personal organization, reminders, archive/restore and deletion. Rename joins the existing versioned settings save. Editors see personal controls and People; owner fields and deletion remain owner-only. Permanent deletion retains the existing explicit confirmation.
- Hide routine connected/connecting messages. Reconnection and failed-read feedback remain visible; the live subscription and refresh fallback continue independently of presentation.
- On phones, show search and one View button. Its modal bottom panel contains the saved-view picker and the existing filter/sort/group/display/preset controls. Display active-filter counts and an unsaved marker on the button. Show the result summary only when filtered or unsaved, avoiding a second unfiltered task count above the Tasks heading.
- Keep the same draft and save logic across phone/desktop resizing. Filter previews remain personal until saved. Closing the panel preserves the draft; browser dialog behavior supports Escape and focus restoration. Saved-view conflicts, failed saves and exact-request recovery are shown inside the phone panel so feedback remains accessible while the underlying page is inert.
- Desktop keeps direct toolbar controls beneath the compact title bar. Sticky column headings account for both title and toolbar heights.

The shared UI package delivers this layout to the website and Tauri frontend. This is a presentation change using existing domain/API/MCP permissions and preferences; no migration is needed.

## Verification

Run against the optimized localhost website and the existing isolated development branch:

```sh
pnpm typecheck
pnpm build
pnpm build:native:web
node --env-file=.env.local --import tsx scripts/verify-list-workspace-ui.ts
```

Browser evidence and final measurements are recorded in `verification.md`. The harness creates disposable Work/Basic lists, removes them in `finally`, and stores additional intermediate screenshots in ignored `.vercel/mobile-task-first/`.

Review images: [phone list](screenshots/mobile-task-first-390.png), [view panel](screenshots/mobile-task-first-view-390.png), [list settings](screenshots/mobile-task-first-settings-390.png).

Local browser and frontend-build evidence does not certify production, an installed native package, physical touch or screen-reader operation.
