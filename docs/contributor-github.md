# Contributor GitHub safeguards

Updated October 25, 2026. This is the GitHub foundation for contributors implementing real
features. `/docs` is the implementation guide and `wuff-contributor` is the single
feature skill; the old standalone prototype workflow is retired.

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

## Independent contribution and delivery policy

The canonical [contributor workflow](contributor-workflow.md) lets contributors
implement and iterate without preliminary approval of briefs, files or technical
choices. No scope hash, path allowlist, exact-file approval or diff-size exception
is required. Keep a proportional brief and actual verification evidence in the PR.
Tim reviews and merges. See [the October 25 decision](contributor-autonomy.md).

`contributor-policy.yml` executes only the policy script checked out from main.
It never checks out PR code, installs dependencies or evaluates content as code.
Pinned checkout/setup actions and its token read PR metadata and write checks;
no production credentials are provided. `pull_request_target` evaluates PR changes.
The job no longer reads comments or requires issue-comment permissions/events.
Existing scope-approval comments have no effect on the new policy.

The policy checks the feature branch/target, concrete PR sections, acceptance
criteria, surface/test declarations, changed-file inventory and current-head
verification evidence. It rejects common credential filenames and invalid paths,
including rename sources, and fails closed on incomplete inventories or API
errors. It does not scan arbitrary contents for secrets or establish evidence
truth. Large diffs can pass without special approval; reviewers can still ask for
a smaller change when that improves review.

Likely high-risk paths (safeguards/instructions, schema/migrations, key access/auth
services, production configuration and native permission declarations) appear as
informational review hints. They do not block implementation or require approval
comments. Ordinary UI, CSS, design tokens, dependencies and contracts have no
path-based gate. Path hints cannot identify every semantic risk: the PR must also
explain changes to admission, authorization, sharing/privacy and consent.

Every PR retains the API/MCP/connection JSON declaration and Unit tests declaration.
Data-changing capabilities need implemented shared-domain/API/MCP mappings and
actual adapter evidence; MCP UI and affected connections need appropriate checks.
Unit coverage must name added/updated unit files and actual cases/results; data
changes cannot waive it. Policy validates declarations and file presence, while
passing tests and human review assess actual quality.

Writing code is distinct from executing operations. Migration execution,
provisioning, production changes/deployments, release publication, destructive
operations on real accounts/data and paid execution need Tim's explicit operational
authorization. Confirm isolated synthetic backends before integration or preview
writes. Never borrow Tim's credentials or weaken safeguards to pass checks.

Use upstream read access plus private forks where supported. A collaborator with
upstream write access can create other workflows and similarly named Actions
checks. Binding a check to the Actions app does not uniquely identify its workflow.
Owner review and restricted credentials remain essential; the metadata policy is
a guardrail for cooperative contributors, not an adversarial security boundary.

The prepared ruleset gives only Tim (GitHub user ID 121096) a PR-only bypass, so
he can merge his own PRs, including overriding failed checks through a PR.
Contributors have no bypass. It remains an activation payload, not evidence of
active protection. Do not expose the owner's credentials to contributor agents.

Bootstrap: Tim reviews/merges the trusted workflow/script and CODEOWNERS. The
workflow cannot validate its new implementation from an unmerged feature branch.
Restore Actions availability and exercise a synthetic PR with no approval comment,
review hints, rejected credential paths, incomplete inventories and stale evidence.
Verify branch-protection read-back before onboarding. This is a one-time setup
requirement, not a per-feature permission loop.

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

The independent-contribution policy is implemented on the feature branch and must
be merged and exercised before its live behavior is established. Isolated contributor credentials/workspaces, Vercel preview
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
