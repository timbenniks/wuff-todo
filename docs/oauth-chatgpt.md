# ChatGPT connection setup — October 23, 2026

ChatGPT's personal connector authorization request omitted `scope`. Wuff required
`lists:read` in every request, so validation failed before sign-in with “This
connection isn’t valid.” The registered callback, resource and S256 PKCE challenge
were valid: an anonymous production reproduction returned the error page without
scope and a 307 sign-in redirect when basic scopes were supplied.

For dynamically registered MCP clients, an omitted `scope` now defaults to
`lists:read tasks:write lists:manage`. The consent screen displays these permissions,
and the decision handler explicitly supplies that same resolved set to the OAuth
library. Authorization codes, access tokens and refresh tokens therefore preserve
the permissions the user approved. GitHub and paid-agent privileges require explicit
scope requests; defaults never include them. An explicit empty or unsupported scope
still fails. Native requests retain their existing explicit-scope policy.

Client registration, exact callback matching, duplicate-parameter rejection, state,
PKCE, resource/issuer validation, admission, list permissions and revocation retain
their existing checks. No migration or account change is required.

The [official OpenAI authentication documentation](https://developers.openai.com/plugins/build/auth)
describes ChatGPT's DCR, S256 PKCE and resource flow. The omitted-scope behavior above
was observed in the actual connection URL supplied by the user.

## Verification

- Isolated checkout rebased onto the deployed `08ac303` production source after
  fetching current main. Existing local uncommitted work was preserved. Both Expo
  and Tauri first-party clients retain their explicit-scope checks.
- `pnpm check` passed: workspace/root TypeScript, all 84 unit tests, optimized web
  build and MCP App bundle.
- The new synthetic development HTTP regression passed: omitted-scope consent shows
  all three basic permissions and excludes GitHub/agent consent; explicit empty and
  unsupported scopes fail; authorization-code exchange, MCP list access and refresh
  preserve the exact default set; the synthetic grant is revoked afterwards.
- All five current Expo/Tauri integration cases passed, including audience
  isolation, read-only permissions, PKCE, concurrency/retries, membership
  revocation, refresh, bearer live capabilities and private-image permissions.
- The initial older-base OAuth/native run passed five cases in 72 seconds. On the
  current production base, the existing uncached-session test still expected the
  former `/connections` page to return 200. It now checks `/settings/connections`,
  matching the released redirect. This changes only the test expectation. The
  corrected case passed in isolation; all eight distinct current OAuth/native
  integration cases passed across those two runs.
- These checks do not certify completion of the user's connection inside ChatGPT.
  A fresh connection attempt in that host remains the final interactive check.

## Production release

Application source `933ea482e7f4d9fe3b7918c42d459da20cbee771` was pushed to main
and deployed through Vercel CLI. Deployment `dpl_GfQckre5CBmn1JJTJC73BgWNtErY`
is Ready, aliased to `https://wuff-todo.vercel.app`, with function region `fra1`.
Anonymous production requests using the registered ChatGPT client and callback,
fresh synthetic state and PKCE, and both omitted/explicit scopes returned 307 to
sign-in. The omitted-scope request previously returned the invalid-connection
page. Anonymous MCP and list API access remain 401. No production grant, list,
task, account or database schema was changed during the smoke check.

The GitHub Verify and native-build workflows were still running at this checkpoint;
local checks and the successful Vercel build are the verified evidence above.
