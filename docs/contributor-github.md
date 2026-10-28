# Contributor GitHub safeguards

Updated October 28, 2026. This is the GitHub foundation for contributors implementing real
features. `/docs` is the implementation guide and `wuff-contributor` is the single
feature skill; the old standalone prototype workflow is retired.

## Current enforcement boundary

`timbenniks/wuff-todo` is now public. Tim explicitly authorized activation of
**Main contributor safeguards**, ruleset **25908933**, on October 26. Stored and
effective main-branch API readback confirms it is active: PRs, resolved review
threads, squash-only merges,
current-branch passing Verify (`check`) from GitHub Actions app
15368, plus force-push/deletion protection. Only Tim has a PR-only bypass;
contributors have none. A contributor-identity rejection attempt is not yet proven.

`.github/CODEOWNERS` designates Tim for every file, including workflows,
instructions and migrations. CODEOWNERS is advisory; the autonomous merge decision below removed required
human approvals. Instructions alone are not enforcement. The previous private-plan
403 responses below are historical and no longer describe protection availability.

A fresh retry of main Verify run 40387514693 (attempt 2) after public conversion
completed setup, frozen install, typecheck and unit tests successfully. Earlier
billing-blocked runs remain historical; current results must be inspected per
commit. See [activation evidence](public-safeguards-activation.md).

## Autonomous merge decision — October 26

Tim explicitly authorized removing human approval gates so Tim and Josibe84 can
merge their own PRs. Ruleset 25908933 now requires zero approving reviews, no
code-owner approval, no last-push approval and no extra approval for unattributed
changes. Stored and effective main-branch readback confirmed these values. Their
current roles are admin and write respectively; no new bypass was granted.
CODEOWNERS remains advisory. PRs, strict passing Verify (`check`),
resolved review threads, squash merging, deletion/force-push blocks
and existing bypass configuration remain unchanged.

Codex review and fixing actionable findings remain the contributor workflow.
Codex does not publish a required pass/fail status here, so it is not a separate
hard merge gate. Resolved threads and required Actions checks are enforced.
Agents still deliver reviewable PRs and need explicit instructions to merge.
Production/migration/destructive/paid operations still need Tim's authorization.
The original activation record below describes the earlier human-approval setup.

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
It requires PRs, resolved review threads, squash merging and current-branch
passing Verify (`check`). It blocks deletion and force pushes. The existing Verify name and GitHub
Actions app ID 15368 were read from actual check runs; the retired policy context
is historical in the activation evidence.

## Lightweight CI and local compilation

Tim selected local platform compilation on October 24. Automatic Verify runs use
one Ubuntu job for workspace/root TypeScript and unit tests, with a frozen pnpm
install, a 15-minute timeout and cancellation of superseded runs. Web builds are
handled by Vercel deployments; they are not part of this required GitHub check.
Native compilation, mobile exports and installed-device checks are local release
evidence, recorded by Tim before shipping affected clients.

Native test builds were disabled and are removed as part of the web/PWA-only
retirement. All 37 artifacts and 3 test releases were removed at Tim's request.
There are no native CI/release gates. Only Verify remains
required; see [retirement](native-retirement.md).

## Independent contribution and delivery policy

The canonical [contributor workflow](contributor-workflow.md) lets contributors
implement and iterate without preliminary approval of briefs, files or technical
choices. No scope hash, path allowlist, exact-file approval or diff-size exception
is required. Keep a proportional brief and actual verification evidence in the PR.
Tim and Josibe84 may merge their own PRs after the required checks and Codex
fix/review loop. See [the October 25 decision](contributor-autonomy.md).

On October 28, Tim requested removal of the contributor metadata gate. The
workflow, script and dedicated tests are retired, and `Contributor policy` is
removed from the checked-in and live main ruleset. See
[retirement evidence](contributor-policy-retirement.md).

The PR template guides useful descriptions; exact heading formats, JSON
schemas and a manually synchronized evidence SHA are no longer machine gates.
Copilot/Codex comments help improve PRs. Actual tests, API/MCP parity, connection
checks, current-source evidence and fixing actionable review findings remain
required by the contributor workflow. Reviewers must inspect access/privacy,
schema, safeguards and credentials directly; the removed filename filter and
path hints no longer run. Review comments do not establish passing tests.

Writing code is distinct from executing operations. Migration execution,
provisioning, production changes/deployments, release publication, destructive
operations on real accounts/data and paid execution need Tim's explicit operational
authorization. Confirm isolated synthetic backends before integration or preview
writes. Never borrow Tim's credentials or weaken safeguards to pass checks.

Use upstream read access plus private forks where supported. A collaborator with
upstream write access can create other workflows and similarly named Actions
checks. Binding a check to the Actions app does not uniquely identify its workflow.
Careful review and restricted credentials remain essential; check names alone
are not an adversarial security boundary.

The active ruleset gives only Tim (GitHub user ID 121096) a PR-only bypass, so
he can merge his own PRs, including overriding failed checks through a PR.
Contributors have no bypass. Its activation is separately read back from GitHub;
file contents alone are not evidence of enforcement. Do not expose the owner's credentials to contributor agents.

For future updates, inspect ruleset 25908933 before changing anything. Do not
create duplicate rulesets or grant contributor bypass. Verify and advisory CODEOWNERS
remain on main. Tim authorizes operational setting changes; ordinary
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
