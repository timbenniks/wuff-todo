# Contributor GitHub safeguards

October 24, 2026. This is the GitHub foundation for contributors implementing real
features. The hosted prototype skill remains a separate design-only workflow.

## Current enforcement boundary

The private `timbenniks/wuff-todo` repository's ruleset and branch-protection API
reads both returned HTTP 403 with “Upgrade to GitHub Pro or make this repository
public to enable this feature.” No protection rule was activated. Keep the
repository private; enabling protection requires the owner's GitHub plan upgrade.
Repository files alone do not prevent pushes, merges or migration execution.

`.github/CODEOWNERS` designates Tim for every file, including workflows,
instructions and migrations. Required code-owner reviews need GitHub protection
enabled and this file merged into the target branch. The PR template captures
scope, preview, verification evidence and technical handoffs.

## Prepared main ruleset

`github-main-ruleset.json` is an activation payload, not evidence of active rules.
It requires PRs, one owner approval, resolved review threads, fresh approvals after
changes, squash merging and current-branch passing `check` and `Contributor policy`
checks. It blocks deletion and force pushes. The existing Verify name and GitHub
Actions app ID 15368 were read from actual check runs; the new policy context
still needs a first live run after bootstrap.

## Lightweight CI and local compilation

Tim selected local platform compilation on October 24. Automatic Verify runs use
one Ubuntu job for workspace/root TypeScript and unit tests, with a frozen pnpm
install, a 15-minute timeout and cancellation of superseded runs. Web builds are
handled by Vercel deployments; they are not part of this required GitHub check.
Native compilation, mobile exports and installed-device checks are local release
evidence, recorded by Tim before shipping affected clients.

The multi-platform Native test builds workflow is manual-only (`workflow_dispatch`),
retained as an optional fallback. No PR or main push starts it. Manually running it
on main still builds all platforms and publishes a complete test prerelease after
the jobs pass. It is not a required PR check. Only the lightweight Verify and
metadata-only policy checks are required; removed native jobs cannot block PRs.

## Scope and evidence policy

The canonical [contributor workflow](contributor-workflow.md) defines the brief,
technical approvals, coding rules, verification matrix and review handoff. It is
published at `/docs/build`, included in the raw agent reference and downloadable
with the `wuff-contributor` skill. The prototype skill remains design-only.

`contributor-policy.yml` executes only the policy script checked out from main.
It never checks out PR code, installs dependencies or evaluates content as code.
Its pinned checkout/setup actions and token can read PR metadata and write checks;
no production credentials are provided. `pull_request_target` evaluates PR updates;
`issue_comment` reevaluates on scope approval edits/deletions. Tim's approval is
identified by immutable numeric user ID, not an agent-written label or PR field.

The policy binds approval to the brief hash, checks changed/renamed paths against
the approved allowlist, requires separate exact-file approval for sensitive paths,
rejects common credential filenames, and requires current-head evidence. It fails
closed on missing scope, incomplete inventories or API errors. Diffs over 800
changed lines require an explicit large-diff exception. It does not scan arbitrary
file contents for secrets, assess evidence truth or understand every semantic risk.

Use upstream read access plus private forks where supported. A collaborator with
upstream write access can create other branch workflows and similarly named
Actions checks. Binding a check to the Actions app does not uniquely identify its
workflow. Owner review is mandatory; a separate externally hosted policy GitHub
App would be needed for stronger check-source isolation against adversarial
collaborators. This metadata check is a guardrail for the cooperative contributor
workflow, not a substitute for permissions or owner review.

Only Tim (GitHub user ID 121096) has a PR-only bypass. This preserves his ability
to merge his own PRs, which he cannot approve himself; it also lets him override
failed checks through a PR. Contributors receive no bypass. Even Tim must use a
PR for normal changes under this ruleset. The owner can still administer rules;
do not expose the owner's GitHub credentials to contributor agents.

Bootstrap: Tim reviews and merges this safeguards PR, including CODEOWNERS and
the trusted workflow/script. The workflow cannot validate itself from an unmerged
feature branch. Restore Actions availability and exercise a synthetic PR with
passing scope, rejected paths, revoked approval and stale evidence. Do not onboard
contributors until those checks are proven and protection read-back is verified.

After upgrading, inspect existing rulesets to avoid duplicates, then activate
through `gh` from the repository root:

```sh
gh api repos/timbenniks/wuff-todo/rulesets
gh api --method POST repos/timbenniks/wuff-todo/rulesets --input docs/github-main-ruleset.json
gh api repos/timbenniks/wuff-todo/rules/branches/main
```

If the named ruleset already exists, inspect/update its ID rather than creating
another. Confirm the stored bypass actor, required checks and review requirements
by read-back. Test rejection with a synthetic contributor identity that has no
bypass before describing contributor enforcement as proven.

## Verification and remaining gates

The October 24 inspection confirmed ADMIN access, a private repository and `main`
as default. Auto-merge was already disabled and was left unchanged. Latest Verify
run 40093282223 failed before job steps; its check annotations identify the account
billing/spending-limit block. Required checks must remain required on failure;
restore runner availability before onboarding contributors.

Scope matching and trusted-base policy code are implemented but not live until
merged and exercised. Isolated contributor credentials/workspaces, Vercel preview
data isolation and controlled migration execution remain onboarding gates.
CODEOWNERS routes review; it is not a database permission boundary.

An October 24 Vercel CLI preview-variable inventory showed integration-managed
database/auth entries assigned jointly to Production, Preview and Development.
No plaintext values were retrieved or compared. Treat previews as unverified and
potentially production-connected. No environment assignment was changed. Verify
backend identity, credentials and side-effect isolation before enabling contributor
preview deployments.

References: [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
and [ruleset REST API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset).
