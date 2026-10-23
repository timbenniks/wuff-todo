# Wuff prototype workspace

Read https://wuff-todo.vercel.app/docs/agent-context.md and the included source-manifest.json first.
This standalone Vite/React/TypeScript/Tailwind workspace contains the actual Wuff
shadcn-style controls and feature components in packages/ui, palette derivation in
packages/design, public types in packages/contracts and client interfaces in
packages/client. It contains no database, domain services, auth credentials or real
user data. Do not connect it to the production app.

Run `pnpm install`, then `pnpm dev`; validate with `pnpm build`. The human does not
need a local checkout: do this in the available cloud prototype/build environment.
Publish/share using the human's available prototype hosting tool only when requested.
If that environment cannot run Vite or host the result, say so and supply the source
and screenshots through an available preview rather than claiming a hosted URL.

Import existing controls from @wuff/ui; do not reinstall default shadcn components
over them. Preserve source under packages/; develop proposals under src/. Use
listThemeVariables or ListTheme, not a hand-copied palette. The sample uses real
TaskRow with in-memory callbacks for names, completion, notes, dates, deletion and
subtasks. Integrations, uploads, sharing and reminder delivery need explicit local
mocks; an unsupported interaction displays a visible error, never a fake success.

Keep a short decision log and a final handoff with problem, scope, behaviors,
permissions, annotated images, prototype/source URL, acceptance criteria and open
questions. Label new components/rules as proposals. Test 320px/390px/desktop,
keyboard/focus, loading/error/empty states, and all palettes relevant to the proposal.
