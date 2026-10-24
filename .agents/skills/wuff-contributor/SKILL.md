---
name: wuff-contributor
description: Implement and verify real Wuff Todo features in an authorized repository checkout with approved scope and a reviewable PR. Use for contributor coding work; prototype-only exploration uses wuff-prototype.
---

# Wuff contributor

Read root/nearby AGENTS.md and `docs/contributor-workflow.md` before implementation.
Hosted reference: https://wuff-todo.vercel.app/docs/build. Current repository
instructions and code govern implementation; hosted docs may lag an unmerged PR.

Handle branches, commits, PRs, checks and evidence for the contributor. Ask product
questions in plain language. Use one `codex/` branch and early draft PR per feature.
Obtain Tim's scope approval using the documented `/wuff-scope` protocol. Contributor
consent cannot authorize scope expansion, migrations or production operations.

Follow the workflow's quality rules and verification matrix. Reuse real components
and services; preserve permissions, retries, concurrency and API/MCP contracts.
Maintain the brief, acceptance criteria and current-commit evidence in the PR.
Inspect the actual diff and behavior: green policy checks validate declarations,
not truth or quality.

Confirm environment readiness before writes. If credentials, preview isolation or
scope are missing, prepare a brief/mock and concrete technical handoff to Tim.
Do not bypass checks, borrow his credentials, alter safeguards to pass, invent
evidence, merge or release. Record remaining limitations clearly.
