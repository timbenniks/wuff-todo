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
changes, squash merging and the current-branch passing Verify `check` job. It blocks
branch deletion and force pushes. The check name and GitHub Actions app ID 15368
were read from the repository's actual check runs.

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
the jobs pass. It is not a required PR check. The prepared ruleset requires only
`check`, so removed native jobs cannot leave PRs waiting for missing checks.

Only Tim (GitHub user ID 121096) has a PR-only bypass. This preserves his ability
to merge his own PRs, which he cannot approve himself; it also lets him override
failed checks through a PR. Contributors receive no bypass. Even Tim must use a
PR for normal changes under this ruleset. The owner can still administer rules;
do not expose the owner's GitHub credentials to contributor agents.

After upgrading, merge CODEOWNERS first, inspect existing rulesets to avoid
duplicates, then activate through `gh` from the repository root:

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

This change does not establish per-feature file allowlists, a trusted external
policy check, isolated contributor credentials, Vercel preview data isolation or
controlled migration execution. Those remain separate implementation work.
CODEOWNERS routes changes for review; it is not a database permission boundary.

References: [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
and [ruleset REST API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset).
