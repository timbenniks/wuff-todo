# Web, MCP and PWA only — October 26, 2026

Tim explicitly retired native apps and all Tauri support. Root AGENTS.md and
wuff-contributor apply. This PR supersedes the documentation-only public-safeguard
PR #39 and includes its verified CI/ruleset evidence and resolved guide finding.

- [ ] Remove Tauri workspace, native SDK, release scripts/workflow and their retired-product tests.
- [ ] Retire native registration and bearer API endpoints with explicit non-data responses; reject native identities/resources in OAuth without weakening MCP.
- [ ] Keep web/PWA service-worker notifications, HTTP API/MCP parity and shared browser utilities.
- [ ] Update current architecture, contributor/module guidance, commands and dependencies; mark historical native evidence as retired.
- [ ] Meaningful retirement/OAuth regressions and remaining type/unit/build/integration checks pass.

Operational cleanup explicitly requested by Tim: Native test builds workflow was
disabled; all 37 native Actions artifacts and 3 test prereleases (15 release
assets) were deleted and zero remaining artifacts/releases read back. Git source,
history and tags remain. No application deployment, database migration, auth-table
write, user-record deletion or medicine action. Existing stored OAuth rows remain;
retired identities/resources are denied in server policy and cannot become MCP
grants. Standard public CI and active main ruleset 25908933 remain enabled.

The web still uses the generic LiveRefreshQueue in @wuff/client; preserve it while
removing native-only SDK classes. Keep shared UI/domain/contracts used by web/MCP.
Native HTML controls (for example native-select) are browser accessibility controls,
not Tauri code, and remain. Runtime retirement changes require authorization,
OAuth/PKCE/refresh/resource isolation and actual HTTP/MCP verification. No MCP
capability or user data migration is required; supported persisted actions remain
on the existing authorized domain, HTTP and MCP services.
