# Foundation verification

Date: October 15, 2026

## Implemented milestone

The initial technical foundation includes the pnpm monorepo, Next.js web application, managed Neon email/password login, application admission, Drizzle migrations, shared list/task services, a session-authenticated HTTP API, delegated OAuth for MCP, MCP tools, and an embedded MCP App.

This is not the complete first release. Sharing permissions are implemented in the domain and tested with synthetic memberships, but invitation onboarding and member-management UI/API are not implemented. Personal sidebar ordering, archive/restore, formal external-client certification, mobile authentication, and production onboarding remain open.

## Automated evidence

- Workspace and root TypeScript checks pass.
- Three contract tests pass.
- Six live integration tests pass against the isolated development branch.
- The Next.js production build passes, including MCP App bundling.

The integration tests cover private-list isolation, admitted versus unadmitted identities, owner-only management, shared task writes, membership revocation, disabled users, idempotent retries, stale versions, task reordering, and completion/reopening.

HTTP/MCP tests cover Neon login, session restoration, logout, denied public signup at the proxy and managed email/password endpoint, unauthenticated requests, OAuth discovery, explicit consent, PKCE rejection, resource mismatch, one-time authorization codes, MCP initialize/tool discovery, cross-surface writes, MCP UI resource retrieval, read-only scopes, refresh rotation, and connection revocation.

## Browser evidence

Manual browser checks used synthetic users and the development database:

1. Opened the authenticated web list and added a task.
2. Opened the embedded view in a local host using the official MCP Apps SDK.
3. Observed the newly added task in that view.
4. Completed the task in the embedded view and observed the completed count on the website.
5. Inspected the layout at a 390-pixel viewport and checked for horizontal overflow.

Screenshots:

- [Web desktop](screenshots/web-desktop.jpg)
- [Web mobile](screenshots/web-mobile.jpg)
- [MCP App test host](screenshots/mcp-app.jpg)

The test host is real protocol integration evidence, not a claim of testing ChatGPT, Claude, Cursor, or other named hosts. Those client checks remain required before advertising compatibility. Automated accessibility certification and a full manual keyboard/screen-reader review have not been completed.

## Production boundary

Production has its own empty application schema and managed auth branch. Real-user onboarding has not happened. Authenticated integration evidence in this document comes from development; deployment and unauthenticated production checks must be recorded separately after the deployment is ready.
