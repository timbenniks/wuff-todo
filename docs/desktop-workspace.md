# Desktop workspace — October 23, 2026

The user asked for Home cards in rows and better use of the desktop canvas across the app. Keep Wuff's existing DM Sans, seven palettes, quiet controls, accessible labels and 44px targets. This is a layout refinement; permissions, ordering, preferences and task behavior stay independent.

## Layout

- The shared web/Tauri workspace uses a 260px navigation column and a fluid main canvas at desktop widths. Main content has 28px gutters, increasing to 36px on wide screens; it no longer centers inside an 896px maximum. Desktop navigation and main content scroll independently, with brand/Home/create controls and account/archive/settings footer outside the scrolling list area.
- Home cards use a responsive grid, with a 320px comfortable minimum that shrinks to the available phone width. Normal laptop widths fit two cards; wider screens fit three. Hidden cards naturally free space, and saved card order is also DOM/keyboard order. Cards retain their natural height.
- Lists remain aligned rows across the available canvas. Wide Your view forms use four columns for filters, without changing filters or shared task order.
- Full task pages and settings can use up to 1440px. Task notes and context form two columns only when the task content itself has at least 960px. Narrow pages and the task drawer retain the single-column reading order. Wide-screen drawers grow from 680px to up to 800px; settings navigation stays visible while its form scrolls.
- Phones retain document scrolling and the existing collapsible navigation. No desktop viewport lock or multiple card columns is imposed on 320/390px screens.

## Verification and release

Use `node --env-file=.env.local --import tsx scripts/verify-desktop-workspace.ts` with the optimized local website, separately from other synthetic auth/fixture runs. It measures card tracks/canvas/overflow at 320/390/768/1024/1280/1440/1920px and checks scrolling, footer visibility, drawer draft retention, task/settings layouts, and existing Home customization/retry/history recovery. Fixtures and personal synthetic preferences are restored afterward. Production deployment and authenticated geometry checks passed; exact evidence is recorded in [verification](verification.md#desktop-workspace--october-24-2026). Installed native devices and screen-reader behavior remain separate checks.
