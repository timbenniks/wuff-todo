# Public repository safeguards — October 26, 2026

## Brief and authorization

Tim made the repository public, then explicitly authorized activating the prepared
Main contributor safeguards ruleset. Root AGENTS.md and wuff-contributor govern
this documentation PR. No app, schema, credentials, workflow code, bot setting or
production deployment changes. Tim retains review/merge.

- [x] Confirm public visibility and current Actions availability rather than assuming old failures still apply.
- [x] Activate only the prepared ruleset after Tim's explicit operational authorization.
- [x] Read back its stored configuration and effective main-branch rules.
- [x] Verify the trusted Contributor policy and Verify checks on an open public PR.

## Live evidence

Repository visibility read back as public. Actions is enabled. The existing main
Verify run 40387514693 was retried after the visibility change (attempt 2), and
all steps passed: checkout, Node/pnpm setup, frozen install, typecheck and unit
tests. Earlier billing-blocked failures remain historical. Main source tested:
`e0b15c14704ec28e4254bcf667752c7c6a38f9de`.

Ruleset 25908933 (`Main contributor safeguards`) is active for refs/heads/main.
Read-back of both the ruleset and /rules/branches/main confirms PRs, one code-owner
approval, stale approval dismissal, resolved review threads, squash merging,
up-to-date required `check` and `Contributor policy` checks from GitHub Actions
app 15368, deletion and force-push protection. Only Tim (user 121096) has a
pull-request-only bypass; contributors have none. CODEOWNERS identifies Tim.
No direct-push or merge attempt using a contributor identity was performed.
Configuration readback is not evidence of that separate rejection test.

Codex review remains an additional review process. These rules require current
checks and code-owner approval, not an invented Codex pass status. Review-loop
instructions still require author fixes/evidence and a current review. No-finding
bot comments are not proof that application tests ran. Current reviewer-trigger
settings for every collaborator/push remain unverified.

## Verification

On live PR #39, the trusted metadata workflow ran from main and created an actual
`Contributor policy` check from GitHub Actions app 15368. Its initial draft
correctly failed because the declaration used a short SHA instead of the required
full current head SHA. The declaration is corrected before final handoff; no
workflow/test/guard was weakened. GitHub reports the PR `BLOCKED` and
`REVIEW_REQUIRED`, consistent with the active protections. Current-head final
check results are recorded in the PR body after completion.

`pnpm build:guide` and `git diff --check` passed locally. This is documentation-only;
there are no new runtime tests or UI/browser/device checks. Existing hosted Verify
executes frozen install, typecheck and the complete unit suite. This PR changes prose/generated guide content only; no new behavior test
should assert the text of these instructions. No production fixture writes,
manual preview, new paid agent run, migration or application release.
