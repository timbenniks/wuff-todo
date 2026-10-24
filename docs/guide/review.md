# Review and deliver a feature

Keep one clear record of the agreed behavior, implementation and evidence in the
PR. The conversation supports that record; Tim should not need to reconstruct it.

## Before asking for review

- Match the final behavior to the brief and observable acceptance criteria. Keep
  exclusions, preserved behavior, permission rules and personal/shared effects explicit.
- Link the exact preview deployment and source commit. Confirm Tim can open it.
  Include simple test steps and annotated phone/desktop screenshots where useful.
- Record the existing components/services reused, intentional visual departures,
  sensitive-file approvals and important technical decisions in feature docs.
- Report applicable success, loading, pending, empty, error, denied and conflict
  behavior, including cancellation, retained drafts and uncertain-save recovery.
- List commands actually run, results, mocked behavior, unverified checks and
  rollout/native/device gates. A green check is not proof that evidence is true.
- For every data-changing operation, include shared domain/API/MCP mappings and
  actual cross-surface adapter evidence. Record the MCP App UI decision and
  affected connection scopes, consent, recovery, revocation and privacy checks.
  Web-only writes and unresolved parity work cannot be presented as complete.

Do not silently expand the scope or turn unanswered questions into requirements.
After new code, rerun affected checks and update the evidence for the current PR
head. Tim can request changes even when every automated check is green.

## Keep Wuff tracking useful

If the contributor asks to create/update a Wuff task, resolve the intended Work
list and check for an existing task first. Read current state/version, preserve
existing notes/attachments, use a fresh operation ID for a new mutation and verify
its result. Do not guess a list or upload images without the user's intent.

Use Todo for scoped work ready to start, In progress while implementing, In review
when submitted and Blocked for a concrete dependency. Do not mark Done or claim
release until the agreed acceptance/release gates are met. A PR, preview and Wuff
task each have a different purpose; label their links clearly.

Without connected Wuff tools, provide a ready-to-paste update. A task write never
by itself authorizes paid agent execution, a migration, merge or production release.

## What the contributor receives

Give a plain-language description of what changed, how to try it, what was tested
and what still needs Tim. Tim owns final review, merge and production release.
