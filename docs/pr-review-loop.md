# Codex review and author fixes — October 26

## Brief

Tim requested stronger Codex review and an author-owned fix/review loop while
GitHub Actions is blocked by billing. Root AGENTS.md and wuff-contributor apply.
This change adds focused review instructions and contributor delivery guidance;
it did not modify GitHub permissions, branch protection, bot settings or CI.
Subsequently on October 26, Tim made the repo public and explicitly authorized
[main safeguards activation](public-safeguards-activation.md); hosted checks now
run. The initial blocked-state evidence below is historical.

- [x] Review rules focus on demonstrated access, medication, retry and test defects.
- [x] Authors address actionable findings with fixes and evidence, then obtain a fresh review of the latest pushed commit.
- [x] Disputed/unresolved findings or unavailable checks remain visible; Tim retains merge authority.
- [x] Documentation distinguishes AI review, tests, and GitHub enforcement.

Codex is an additional reviewer. No findings is not proof tests ran. At the initial review-loop change, private-repository protection was unavailable
on the then-current plan and Write collaborators could merge/direct-push. The
subsequent public conversion and active ruleset now require current checks and
Tim's code-owner approval. An Actions billing reset alone would not have enabled
that separate protection feature. This workflow is
an instruction to cooperative contributors, not a technical merge lock.

Verification plan: review documentation links/consistency, regenerate the hosted
contributor guide, run existing unit/type checks, and evaluate final PR metadata.
No runtime behavior/schema/scope change, production operation or new provider send.
No new unit test should assert prose or pretend it enforces a remote review.

## Verification and remaining setup

`pnpm typecheck` passed across workspaces/root; `pnpm test` passed 231 existing
unit tests with no skips; `pnpm build:guide` regenerated the hosted build guide and
portable contributor skill successfully. `git diff --check` passed. No new unit
test asserts prose or claims to enforce reviewer behavior. This changes
instructions/templates only, not application code or CI settings.

Codex's connected GitHub bot demonstrably reviewed PR #37's final commit, but its
coverage of every collaborator and each subsequent push was not verified. The
browser was unavailable when attempting to inspect Codex settings. Tim should
check the repository's Automatic review setting (All PRs for collaborator coverage)
and review trigger/personal preferences; explicit `@codex review` is the workflow
fallback when the latest head has no review. No bot setting, access grant, paid
execution or protection rule was changed. A missing review remains a draft/handoff,
not a clean result. Actual review quality is not proven by unit tests or prose.

Use [official review setup guidance](https://learn.chatgpt.com/docs/third-party/github)
and [repository review rule guidance](https://developers.openai.com/blog/custom-code-review-rules-for-codex).
The initial live enforcement limitations are in [GitHub safeguards](contributor-github.md).
