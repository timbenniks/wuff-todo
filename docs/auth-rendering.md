# Session reads during server rendering

Date: October 17, 2026

## Production failure and fix

Production reported `Cookies can only be modified in a Server Action or Route Handler`, digest `2720111743`, at 06:10:59 UTC. The shared `webIdentity()` used the installed Neon Next.js SDK's writable request context during Server Component rendering. The SDK applies upstream `Set-Cookie` headers before returning session data. Renewal or clearing can therefore throw before the page receives an identity.

Page rendering now uses a read-only adapter built with the installed SDK's public `createAuthServer` toolkit. It always bypasses the session-data cookie cache and requests `disableRefresh=true`, so the managed service validates the current session without renewing it during rendering. The adapter never invokes Next.js cookie mutation, including when the upstream response clears an invalid cookie. A page read does not persist upstream cookie changes.

`pageActor()` is used by the lists, connections and OAuth consent pages. Route Handlers continue using `webActor()` and the original writable Next.js SDK adapter: online API reads/writes and auth endpoints can still renew or clear cookies. Both actor paths call the same enabled-profile/admission and expected-account checks. The fix adds no catch for cookie-write exceptions, no cached identity becomes authoritative, and no auth-managed table or cookie security flag changes.

Pages alone do not extend a session's lifetime. Normal list polling/live API requests, connection reads, consent submission and explicit auth operations retain renewal through Route Handlers. An expired or signed-out session still redirects to sign-in.

## Verification

- `pnpm check` passed: workspace/root TypeScript, all 27 unit tests and optimized web/MCP builds.
- A new SDK regression test supplies an upstream session-cookie deletion response without any writable Next.js request context and receives a signed-out result. It checks cache bypass, disabled renewal, Neon-only cookie forwarding and origin forwarding. Additional cases preserve valid identity, 401 signed-out, 429 throttling and 5xx unavailable semantics.
- The development auth/MCP integration tests exercised real Neon sign-in, uncached lists/connections server rendering, signed-out page redirect, closed signup, unadmitted account rejection, OAuth consent, PKCE, scopes, refresh rotation and client revocation. An initial added assertion incorrectly expected CSS-uppercase text in raw HTML; correcting it to the source text passed the focused login rerun. The OAuth/MCP case passed unchanged.
- A fabricated invalid cookie did not reproduce the intermittent failure before the change. The forced upstream cookie response in the regression test specifically covers the SDK write branch identified in the production stack. No claim is made that a naturally aged production session was reproduced locally.

The complete auth/MCP integration file then passed both tests in one run against the optimized Next.js runtime on the isolated development branch (38.2 seconds). Its disposable list and client grants were cleaned up by the existing test flow. This is protocol/server-rendered HTTP evidence, not a real ChatGPT host test. Production release evidence follows below after deployment.

## Sources

Implementation was checked against the installed `@neondatabase/auth` 0.6.0-beta adapter/toolkit source, its exported request-context contract, and Next.js 16.4.1's bundled cookies documentation. The upstream Better Auth session implementation supports the `disableRefresh` query. The [Neon Auth skill](https://neon.com/docs/ai/skills/neon-auth/SKILL.md) was also reviewed. [Next.js cookies documentation](https://nextjs.org/docs/app/api-reference/functions/cookies) explains the read/write boundary.
