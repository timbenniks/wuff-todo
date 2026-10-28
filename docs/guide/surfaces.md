# API, MCP and connections are core product surfaces

Wuff is an app and an agent-accessible service. A feature is incomplete when it
changes persisted data only through the website. Every contributor must design and
verify its API, MCP and connection behavior before calling the feature complete.

## Every mutation has equivalent capabilities

For each create/update/delete/reorder/archive action, personal preference or other
persisted data change, identify the shared server-side domain operation, authorized
HTTP API route and MCP tool. Reuse an existing route/tool when its contract already
supports the action; a new feature does not always require a new endpoint name.
Include authorized reads so an agent can discover the current state and verify a
write. Update shared contracts, client adapters, tool schemas/descriptions and
returned snapshots together. No business logic or permission checks belong only
in a page handler, React component or MCP adapter.

API and MCP use the same domain services, actor/access rules, validation, defaults,
personal/shared semantics, version conflicts, operation IDs and retry behavior.
Both must return enough authorized state to reconcile success or recover from an
uncertain save. Existing web/PWA views must refresh after MCP writes and MCP
reads must reflect API writes. Preserve pending drafts during remote refresh.

No web-only mutations, placeholder tools or silent API/MCP deferral. If backend
scope or credentials are unavailable, keep a clearly labeled draft/mock and hand
Tim the required technical changes. Do not ship the feature as complete.

## Decide whether it needs an MCP App UI

Consider extending the existing MCP App when the feature benefits from browsing,
selecting, editing structured content or inspecting state visually. Reuse the
shared design/components and authorized tools. A small atomic tool action may
need no new UI; explain that decision in the brief.

The PR declares either implemented UI with verification, or not-needed with a
reason. Required UI cannot be silently deferred. Tool-only usage must remain
complete in clients that cannot render an MCP App. Respect host sandbox/resource
policies, never embed secrets, and distinguish protocol/local SDK proof from an
actual named host's interactive behavior.

## Treat connections as part of the feature

Review both delegated Wuff AI-client connections and external provider connections
such as GitHub/Cursor. Declare affected connection types, required scopes, explicit
consent, setup/status/disconnect behavior and any secure browser handoff. Reuse
existing connection management; do not create a parallel token store or silently
add scopes to existing grants. Refreshes cannot expand authorization.

Missing, expired, revoked or insufficient-scope connections need explicit recovery
without falsely reporting success. Revocation must take effect on the next access
and on retries/replayed receipts. A shared list never grants another person's
credentials, provider consent or paid execution rights. Secrets remain server-side
and never appear in MCP output, client bundles, logs or screenshots.

API/MCP equivalents expose authorized capabilities and status, never raw tokens
or privileged internal callbacks. Use the existing browser consent/sign-in handoff
when secrets or provider policy require it, with an agent-usable status/recovery
path. Call out new scopes or changes to consent/auth for Tim's review before merge;
preparing and testing code does not require preliminary approval.

## Evidence required before review

For each mutation, show an API write followed by an MCP read and an MCP write
followed by an API/web read against isolated synthetic data. Exercise relevant
owner/editor/outsider access, personal-state isolation, invalid input, duplicate
operation IDs, stale versions and concurrent writes. Confirm defaults and returned
state match across adapters. New adapter coverage must call the actual adapters;
mocking their responses does not prove parity.

For affected connections, cover absent/expired/revoked grants, missing scopes,
explicit consent recovery, disconnect, cross-account privacy and retries after
revocation. For MCP UI, exercise its actual controls and tool-only fallback, state
which host/runtime was tested, and refresh the tool catalogue after schema changes.
Builds and JSON declarations alone never prove this behavior.

## Record the surface contract in every PR

Describe persisted operations with their shared domain function, authorized HTTP
route, MCP tool and actual adapter verification. Explain the MCP App UI decision
and connection/scope/consent/revocation impact. For changes with no persisted-data
behavior, explain why these surfaces are unaffected.

Keep this proportional and current as implementation evolves. Plain language or a
table is sufficient; no JSON schema or metadata check is required. Drafts may
contain planned operations, but implementation and verification must be complete
before claiming delivery. Copilot/Codex review comments help identify omissions;
reviewers still inspect actual code and adapter evidence.
