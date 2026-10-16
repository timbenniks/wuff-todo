# Waffles' voice

Updated: October 16, 2026

Waffles is a friendly little companion, not a corporate mascot. App-authored conversation should sound like this corgi: warm, short, helpful, with a small dog joke. This applies to the website and embedded MCP App, including sign-in, account recovery, AI connection consent, sharing, list settings, notes, loading, empty states, saving, errors and reorder feedback.

## Writing rules

- Put the useful message beside the joke. “Pup to date · Live updates connected” still tells someone what happened. “Ruff patch!” alone does not explain a failure.
- Vary the wordplay: paws/pause, pup/up, de-tails/details, fur-got/forgot, fetching, pack, sniffing and tail wags. Prefer one small joke per message; do not stack a new prefix on an error that already has Waffles' voice.
- Keep controls, field names, role names, permissions and irreversible consequences explicit. “Delete list,” “Email,” “Editor,” and “Allow connection” remain recognizable. Surrounding guidance carries the joke. A destructive confirmation still says who is affected and that it cannot be undone.
- Never rewrite user content: list/task/section names, notes, image descriptions, email addresses and AI client names stay verbatim. Default example copy is authored by the app and can be playful.
- Keep machine contracts unchanged: IDs, API keys, OAuth scopes, error codes, JSON and structured MCP results are data. Human-readable error presentation may add the voice; structured tools do not need extra success chatter.
- Never hide a failure, uncertain save, retained draft, access restriction or recovery step behind a joke. Screen-reader instructions retain the actual keys and actions.

## Shared copy

Recurring messages live in `apps/web/src/lib/copy.ts`, which can be imported by both web components and the MCP App without server dependencies. `wuffError` retains the original error explanation and avoids decorating recognized branded errors twice. `taskCount` handles zero, one and multiple tasks without broken grammar. Screen-specific prose stays beside its UI; this is an editorial convention, not an internationalization framework.

| Situation           | Example                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Password recovery   | New to the pack or fur-got your password?                                                   |
| List colors         | Give your list a little paw-sonality.                                                       |
| Sections            | Corg-anize with a section name                                                              |
| Empty list          | No tasks to fetch. Time for a little paws.                                                  |
| Active tasks        | 1 task to fetch and finish                                                                  |
| Sharing permissions | Pack rules: editors can change tasks. Only the owner can rename, delete, or share the list. |
| Refresh failure     | We lost the scent of your invitations. We’ll check again shortly.                           |

## Verification

This pass changes presentation copy only; database schema, authentication, permissions, saved content and protocol contracts are unchanged.

- `pnpm check` passed: workspace/root TypeScript checks, all 22 existing unit tests, optimized Next.js and MCP App builds. Static scanning of 20 browser scripts found no environment secrets or domain SQL. No new copy-only tests, migrations or dependency changes were needed.
- On the optimized local build, a synthetic account showed the new list-name placeholder, saving/live status, zero/one/multiple task wording, list settings and sharing rules. New list/task names stayed verbatim. [Settings screenshot](screenshots/waffles-voice-settings.jpg).
- The sharing dialog fit a measured `innerWidth = scrollWidth = 390`, with explicit owner/editor rules and invitation delivery limitations. [Phone-width screenshot](screenshots/waffles-voice-mobile.jpg). This is browser layout evidence, not a physical-device or screen-reader certification.
- The current embedded bundle loaded in an `allow-scripts` sandbox using the official MCP Apps SDK and an authenticated synthetic development OAuth connection. The section placeholder, shared catalog heading and status appeared correctly. [MCP App screenshot](screenshots/waffles-voice-mcp.jpg). The old baseline host's expired token was replaced with a temporary dedicated fixture; the baseline fixture was preserved. This does not certify a named AI client's rendering.
