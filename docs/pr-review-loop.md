# Codex review and author fixes — October 26

## Brief

Tim requested stronger Codex review and an author-owned fix/review loop while
GitHub Actions is blocked by billing. Root AGENTS.md and wuff-contributor apply.
This change adds focused review instructions and contributor delivery guidance;
it does not modify GitHub permissions, branch protection, bot settings or CI.

- [ ] Review rules focus on demonstrated access, medication, retry and test defects.
- [ ] Authors address actionable findings with fixes and evidence, then obtain a fresh review of the latest pushed commit.
- [ ] Disputed/unresolved findings or unavailable checks remain visible; Tim retains merge authority.
- [ ] Documentation distinguishes AI review, tests, and GitHub enforcement.

Codex is an additional reviewer. No findings is not proof tests ran. Existing
private-repository protection is unavailable on the current plan; an Actions
billing reset does not enable that separate feature. Write collaborators can
still merge/direct-push unless GitHub protections are enabled. This workflow is
an instruction to cooperative contributors, not a technical merge lock.

Verification plan: review documentation links/consistency, regenerate the hosted
contributor guide, run existing unit/type checks, and evaluate final PR metadata.
No runtime behavior/schema/scope change, production operation or new provider send.
No new unit test should assert prose or pretend it enforces a remote review.
