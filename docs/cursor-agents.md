# GitHub PR tracking and Cursor agents

Selected October 20, 2026. First implementation built and locally verified; not deployed or live-provider verified.

The user resumed developer-agent work after researching a conversational workflow: create a Work list and tickets in chat, bind GitHub, configure Cursor, launch coding work, discuss requirements, and review PRs. Native push notifications remain a later milestone.

## First implementation

- Related PRs are discovered from same-repository issue timeline references and read from the PR API. Snapshots include draft/open/closed/merged state, latest review per reviewer, and check-run summary. These summaries do not certify repository branch-protection requirements or legacy commit statuses. Missing Checks permission is shown as unavailable. Bounded discovery reports truncation.
- Signed PR/review/check/status webhooks invalidate snapshots and advance list versions. Active task views poll; the snapshot has a short cache lifetime. GitHub remains authoritative. PR merge alone does not mark a task Done; existing issue-close synchronization still does.
- A Work list selects one Cursor environment containing only its bound GitHub repository. The owner explicitly consents to exposing conversation instructions and final replies to current/future list members.
- Owner-only paid launches and follow-ups require new `agents:manage` OAuth consent, current list version, operation UUID and explicit confirmation. Existing grants do not gain that scope. Planning is the default. Execution mode may create PRs; merges/deployments are excluded from generated instructions.
- Each ticket has a durable conversation, with separate per-message runs and immutable prompt snapshots. Run completion does not change task workflow status.
- The initial agent ID is deterministic. Lost initial responses are recovered through that ID. Follow-up POSTs have no documented provider idempotency key; a crash or unknown response becomes uncertain and blocks additional messages. After inspecting Cursor, the owner may explicitly attach the matching provider run ID through recovery. Recovery verifies the conversation and launch time; it cannot prove prompt equivalence.
- Cancelling a queued run prevents dispatch; cancelling a dispatched run requests provider cancellation. Deleting/archiving active or uncertain work is blocked until resolved.
- Task conversations are available on the website and through MCP. Owner-only activity reads return bounded batches from Cursor's SSE stream, with a continuation cursor and explicit expiration. Tool arguments/results and rich SDK events are excluded. Assistant/thinking text is provider-generated private content, not a complete or guaranteed reasoning transcript. Activity is not stored in Wuff; prompt snapshots and final replies are stored.

## Secrets and setup

`CURSOR_TOKEN_SECRET` is an independent random encryption key of at least 32 characters. Existing stored API keys are encrypted with AES-256-GCM in application-owned tables. All users, including Tim, use the same personal-connection storage path. Connecting a replacement key after conversations exist is blocked pending verified identity-preserving rotation. No key value is returned by HTTP/MCP.

Cursor authentication uses an encrypted personal connection in `wuff_agent_accounts`, keyed by the admitted Wuff user ID. There is no global API-key fallback or privileged deployment owner. `CURSOR_TOKEN_SECRET` is a separate random encryption key in the server environment, never the Cursor-issued API key. Keep it stable and backed up securely; changing it requires re-encryption of stored records.

Connections accepts a personal Cursor key through a same-origin authenticated request, validates it with `/v1/me`, and stores AES-256-GCM ciphertext with a fresh random nonce. Plaintext keys are never returned through HTTP/MCP or stored in browser persistence. List membership does not grant credential access. Existing owner-only launch and environment permissions remain in force; shared-editor paid execution was not added. Replacement after conversations exist remains blocked pending identity-preserving rotation support.

The `/connections` website accepts personal API keys and environment-secret values through same-origin authenticated POSTs. `/agents` redirects there, preserving list context. Secret values are forwarded to Cursor's environment-secret API, scoped to the selected repository, and are not stored by Wuff. Updating an existing name rotates that secret; ambiguous versions fail rather than picking one. MCP receives required names and missing/configured status, and directs the user to the secure setup page. There are no MCP parameters for secret values.

Use development credentials and synthetic data. Commands, task notes, follow-up text and provider-generated replies can contain whatever users/agents write; this implementation cannot guarantee redaction of arbitrary secrets embedded in prose. Do not paste credentials into them. Raw tool arguments/results are intentionally excluded from activity reads.

Readiness checks environment identity/repository and explicitly required environment-secret names. It is not proof that install commands, credentials, tests or builds work. Team/user secret inheritance, build-secret editing, team environment creation, ticket-specific secret overrides and credential revocation/rotation UI remain follow-ups.

## Execution and background processing

`CURSOR_EXECUTION_ENABLED` defaults to false. Disabled execution rejects new paid work, rather than accumulating a queue that could run unexpectedly when enabled.

Durable runs are claimed with leases. Web/MCP requests wake bounded workers; the existing daily recovery endpoint also processes runs. **Those wakeups alone do not guarantee timely unattended completion tracking.** Before enabling production execution, configure an always-on worker with:

```sh
node --env-file=.env.local --import tsx scripts/agent-worker.ts
```

The file above is an example for an isolated local deployment; production must supply its own environment securely. The worker checks every fifteen seconds. Cursor continues running independently of Wuff; a stopped Wuff worker delays result/cancellation reconciliation. The worker rejects queued runs older than thirty minutes and requests cancellation for dispatched runs past that age. This is cooperative cancellation, not a hard spending cap. Hosting this worker, account spending controls, and unattended end-to-end verification remain release gates.

Cursor v1 is public beta and does not currently document v1 completion webhooks. Do not mix v0 webhooks into v1 runs without a verified contract. Stream retention is finite; permanent raw transcript capture is not implemented.

## MCP surface

`get_agent_connection`, `list_agent_environments`, `get_agent_readiness`, `create_agent_environment`, `bind_agent_environment`, `launch_task_agent`, `message_task_agent`, `get_task_agent`, `get_agent_activity`, `cancel_task_agent`, `recover_agent_run`.

Launch and follow-up are explicit paid actions. Creating a list, task or GitHub issue does not authorize launching an agent. Initial release is one ticket at a time; automatic issue-triggered launches and batch orchestration remain future work. Native agent UI and push notifications remain deferred.

## Release gates and verification

Migration `0011_true_husk.sql` adds application-owned agent account/binding/conversation/run tables and PR snapshots. `0012_pink_ironclad.sql` adds validated provider PR references to runs. No existing task or auth-managed table changes. Both were applied to the isolated development database and then production on October 20. Production user/list/task/member counts (2/5/20/1) and row fingerprints were preserved. No auth-managed tables were modified.

Before enabling production execution: configure the existing GitHub App's PR/review subscriptions and Checks read permission with owner consent, configure Cursor credentials/environment, host the worker, and perform one explicitly authorized paid sandbox pilot. Confirm environment access, run/stream shapes, cancellation, generated PRs and account plan eligibility against the actual Cursor account.

Local verification on October 20:

- `pnpm check` passed: workspace/root TypeScript, 55 unit tests, optimized web build and MCP App bundle.
- Final focused development integration run passed both agent and GitHub suites. Provider responses were mocked; the real isolated database exercised owner/member isolation, required secrets, concurrent launches, replay/conflict handling, uncertain delivery recovery, cancellation, activity filtering, PR state/reviews/checks, signed webhook invalidation and duplicate delivery.
- Authenticated OAuth/HTTP/MCP tests passed, including rejection of older grants without `agents:manage`, anonymous requests and cross-origin writes. These are protocol tests, not a named AI client's live Cursor session.
- Chrome against the local production build displayed the synthetic Work ticket and setup page. Ticket layout measured no horizontal overflow at 320, 390 and 1280 pixels; setup measured no overflow at 320 pixels. The launch button measured 44 pixels high. Credential entry, populated live conversations, real PR rendering, screen readers and physical devices were not browser-certified.
- A development-mode module-factory cache failure did not reproduce against the production build. An earlier combined integration rerun failed with a database socket error; the isolated agent rerun and final two-suite run passed.

No paid agent was launched and no application deployment occurred. Production agent tables and Tim’s encrypted personal connection were provisioned; the global API key and owner environment variables were removed after readback/decryption verification. Automatic multi-ticket orchestration is not part of this first slice.

Sources checked October 20, 2026:

- [Cursor Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints) and [OpenAPI schema](https://cursor.com/docs-static/cloud-agents-openapi.yaml)
- [Cursor environment setup](https://cursor.com/docs/cloud-agent/setup)
- [GitHub webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [GitHub issue/PR linking](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
