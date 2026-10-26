# Contributor GitHub safeguards

Updated October 26, 2026. This is the GitHub foundation for contributors implementing real
features. `/docs` is the implementation guide and `wuff-contributor` is the single
feature skill; the old standalone prototype workflow is retired.

## Current enforcement boundary

`timbenniks/wuff-todo` is now public. Tim explicitly authorized activation of
**Main contributor safeguards**, ruleset **25908933**, on October 26. Stored and
effective main-branch API readback confirms it is active: PRs, one code-owner
approval, resolved review threads, dismissed stale approvals, squash-only merges,
current-branch passing `check` and `Contributor policy` from GitHub Actions app
15368, plus force-push/deletion protection. Only Tim has a PR-only bypass;
contributors have none. A contributor-identity rejection attempt is not yet proven.

`.github/CODEOWNERS` designates Tim for every file, including workflows,
instructions and migrations. GitHub now requires that approval through the active
ruleset. Instructions alone are not this enforcement. The previous private-plan
403 responses below are historical and no longer describe protection availability.

A fresh retry of main Verify run 40387514693 (attempt 2) after public conversion
completed setup, frozen install, typecheck and unit tests successfully. Earlier
billing-blocked runs remain historical; current results must be inspected per
commit. See [activation evidence](public-safeguards-activation.md).

## Historical review setup while Actions was unavailable — October 26

The live Codex app reviewed PR #37 at head `5f59383` and reported completion with
no findings. The separate GitHub Actions Verify job for merged main did not start
because account payments/spending limits blocked runners. A bot review is code
analysis, not proof that unit, integration or build commands ran.

Root AGENTS.md supplies focused Code Review Rules; the contributor workflow/skill
requires an [author fix/review loop](contributor-workflow.md#resolve-review-findings).
The PR template records latest reviewed SHA/link, fix evidence and unresolved
findings. These are cooperative instructions. This change does not configure the
Codex account's automatic-review coverage/triggers or add a required GitHub check.
Check repository and personal review settings for collaborator coverage; explicitly
request review when an eligible PR/head has not been reviewed. Read actual review
status, rather than assuming every push triggered it.

The planned November Actions billing reset and private-repository branch-protection
availability are separate. A billing reset may restore runners; it does not enable
the plan-gated protection API. CODEOWNERS and a no-findings comment cannot stop a
Write collaborator merging/pushing to unprotected main. Tim retains review/merge
in the contributor workflow. Do not describe this guidance as an enforced gate.

Sources: [official Codex review guidance](https://learn.chatgpt.com/docs/third-party/github)
and [custom repository review rules](https://developers.openai.com/blog/custom-code-review-rules-for-codex).

## Activated main ruleset

`github-main-ruleset.json` is the reviewed activation payload. Actual activation
and effective-rule readback are recorded above and in the activation evidence.
It requires PRs, one owner approval, resolved review threads, fresh approvals after
changes, squash merging and current-branch passing `check` and `Contributor policy`
checks. It blocks deletion and force pushes. The existing Verify name and GitHub
Actions app ID 15368 were read from actual check runs; the new policy context
is verified on live PRs as recorded in the activation evidence.

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

The active ruleset gives only Tim (GitHub user ID 121096) a PR-only bypass, so
he can merge his own PRs, including overriding failed checks through a PR.
Contributors have no bypass. Its activation is separately read back from GitHub;
file contents alone are not evidence of enforcement. Do not expose the owner's credentials to contributor agents.

For future updates, inspect ruleset 25908933 before changing anything. Do not
create duplicate rulesets or grant contributor bypass. The trusted workflow/script
and CODEOWNERS are on main. Tim authorizes operational setting changes; ordinary
feature implementation continues without preliminary approval.

## Verification and remaining gates

The October 26 live inspection confirmed public visibility, Actions enabled and
no pre-existing branch/ruleset protections. After explicit authorization,
`POST /rulesets` created 25908933 and both stored/effective reads confirmed it.
The real main Verify retry passed. Open-PR required-check evidence is recorded in
[the activation report](public-safeguards-activation.md). No fabricated
contributor-identity rejection or exhaustive bot review is claimed.

Isolated contributor credentials/workspaces and safe test backend configuration
remain separate onboarding gates. Public CI runs only synthetic/unit checks with
no production secrets. Do not put secrets or real medicine data in public PRs,
artifacts, logs or screenshots. Manual preview deployment remains disabled by
Tim's workflow preference; public visibility does not establish backend isolation.

References: [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
and [ruleset REST API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset).
