# Shared browser controls

WUFF-73 moves the website's existing shadcn-style Button, Input, Textarea, NativeSelect, InputGroup and StatusTag into `@wuff/ui`. Website import paths remain compatibility re-exports, so feature callers keep their existing props and behavior. Tauri imports the same Button source. The package contains no Next.js, server, database, domain or app-alias imports.

`design-system.css` and the Tailwind theme mapping also live in the package. Both web and native explicitly scan the shared package for utility classes. The MCP builder reads the same design CSS directly; it does not acquire a React runtime. The seven palettes remain in `@wuff/design`, with their existing tests. Fonts and Waffles keep their single existing source assets.

The move preserves the current controls, variants, labels, focus styles and 44px default touch dimensions. Routing, authentication and file access remain outside this package. It does not attempt to port full Next.js screens or introduce new visual styles.

Verification: `pnpm check` (workspace/root TypeScript, 65 unit tests, web/MCP build) and native frontend production build are the required regression checks. Runtime observations are recorded below after those checks finish.

October 22 results: frozen install, `pnpm check` (65/65 tests) and native frontend build passed. The packaged macOS client renders the shared button. The synthetic website rendered at 320px and 390px with no document overflow; the Add task control measured 44px high. List settings rendered its shared select/textarea controls; Escape closed it and restored focus to List settings. Existing seven-palette tests passed. Explicit native heading weight/margins preserve the pre-extraction typography against Tailwind's reset. No new backend behavior or database migration is introduced.
