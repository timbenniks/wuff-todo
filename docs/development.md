# Development and operations

Updated: October 15, 2026

## Provisioned infrastructure

- Private GitHub repository: `timbenniks/wuff-todo`.
- Vercel project: `wuff-todo`, under `tim-benniks-projects-1b967033`.
- Project root directory: `apps/web`; the build command runs the root workspace build.
- Neon resource: `wuff-todo`, provisioned through `vercel integration add neon` on the free plan in Frankfurt.
- Neon project: `noisy-leaf-56955387`.
- Main branch: `br-twilight-glitter-b9dbgk2g`.
- Development branch: `br-plain-field-b9ubcjv4`.
- App and database compute are configured in Frankfurt.

The Vercel project default and both root/app configuration files pin `fra1`. From the monorepo root, deploy with `vercel deploy --prod --yes --regions fra1 --scope tim-benniks-projects-1b967033`, then inspect the actual deployment's regions. A prior CLI deployment fell back to `iad1` despite the app-level build configuration containing `fra1`; see [performance findings](performance.md).

Database provisioning, project connection, environment retrieval, and deployment use the Vercel CLI. Neon CLI authentication was subsequently completed for auth controls and development-branch management that the Vercel CLI does not expose.

## Local environment

Use Node 22 and pnpm 10.33.3. Run `pnpm install --frozen-lockfile` from the repository root.

The ignored root `.env.local` holds the isolated development database/auth configuration and a generated cookie secret. The local launcher reads this file before starting Next.js. Production values are separately preserved in ignored `.env.production.local` on the initial development machine. Neither file belongs in Git or a deployment upload.

`vercel env pull` currently retrieves the integration's main-branch values. Do not use that file directly for local test writes. Resolve the development branch's connection strings and auth URL through the Neon CLI and place those values into `.env.local`. Do not print connection strings or secrets into shared logs.

Required variables are listed in [the environment template](../.env.example). Use a randomly generated cookie secret of at least 32 characters. Production and preview cookie secrets are stored separately through Vercel CLI. `WUFF_ORIGIN` is fixed for production; previews derive their origin from `VERCEL_URL` when it is omitted.

## Commands

```sh
pnpm dev
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm db:generate
pnpm db:migrate
```

Integration tests require the local application on port 3000 and `.vercel/dev-users.json`. They verify real Neon sessions and database operations using disposable synthetic identities. They must never target production. The loopback-only browser fixture can be started with:

```sh
node --env-file=.env.local --import tsx scripts/browser-fixture.ts
```

Its `/login` route on port 4173 establishes a real synthetic-user session on localhost. Its root page runs the MCP Apps SDK host against authenticated live MCP tools. Credentials remain in server memory. Stop the fixture with Ctrl-C to delete its sample list and revoke its OAuth connection. This fixture is outside the Next.js application and is not deployed.

The initial synthetic accounts were created on development with verification emails off, then managed public sign-up was closed again. `scripts/seed-development.ts` is restricted to that branch and uses reserved `example.invalid` addresses. It is not an invitation or production bootstrap mechanism.

The activation test additionally requires a dedicated synthetic identity, provisioned with the operator command below using target `development`, email `activation-fixture@example.invalid`, and name `Activation fixture`. This test asks managed Auth to create an expiring challenge for a reserved, non-deliverable address; it does not prove mailbox delivery or successful code redemption.

## Authentication boundary

The first milestone supports email/password login for pre-provisioned identities. Public email/password sign-up is disabled in managed Neon Auth on both main and development, and rejected by the application's auth proxy. Default shared Google OAuth was removed from both branches; magic-link and phone login remain disabled. The proxy exposes email sign-in, session reading, sign-out, and admission-gated password activation/recovery.

An authenticated Neon identity also needs an enabled `wuff_users` profile before it can access lists, receive an OAuth grant, or call MCP tools. Identity alone never grants application access. Testing separately proved that an authenticated, unadmitted identity is denied.

Wuff exposes only `email-otp/request-password-reset` and `email-otp/reset-password`, using the managed service's live OpenAPI contract. Both are POST-only, same-origin, validated, and restricted to enabled application profiles. Requests for unknown/disabled emails return a generic success without forwarding to Neon. Resetting requires the email code and an 8–128 character password. Neon enforces challenge expiry, attempt limits, and request throttling. Email-OTP sign-in/registration and all other OTP endpoints remain blocked at the proxy; upstream identity creation is not exhaustively tested. Application admission is enforced independently.

### Provision an invited account

An operator creates a managed identity through the Neon CLI, then an enabled Wuff profile linked to that identity. No public bootstrap endpoint exists. The command checks for existing identities and profiles, reconciles unknown CLI outcomes, preserves existing disabled profiles, validates the target environment, and never displays passwords or codes. It reads managed tables for identity reconciliation but never writes them.

```sh
pnpm exec tsx scripts/provision-user.ts --target production --email invited@example.com --name 'Invited person'
```

Use `--target development` for synthetic tests. The selected ignored environment file must contain credentials for the corresponding configured branch.

The recipient visits `/set-password`, enters their invited email, requests a code, and chooses a password in the website. The same page supports recovery. No initial password is sent through chat. The first two production identities and Wuff profiles have been provisioned. Tim reported successful activation; independent activation and mailbox verification for Joreel remain user checks.

Auth currently uses Neon's shared sender (`Neon Auth`, `auth@mail.myneon.app`) for this initial private setup. Configure custom SMTP before treating email delivery as production-ready. Existing-account list invitations use an in-app inbox; they send no email. See [sharing](sharing.md) for the implemented flow.

MCP authorization uses `@node-oauth/oauth2-server`, separate from Neon identity. Public clients register via DCR and receive only the `authorization_code` and `refresh_token` grants. Authorization requires explicit consent, S256 PKCE, state, exact registered redirect matching, and the MCP resource. Tokens are opaque, stored as SHA-256 digests, resource/issuer-bound, short-lived, and revocable. Every token use checks application admission. Refresh tokens rotate. Client ID Metadata Documents and native custom callback schemes are not implemented yet.

## Implemented endpoints

| Endpoint                                                               | Purpose                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------ |
| `/api/auth/[...path]`                                                  | Restricted Neon session/login proxy              |
| `/api/v1/lists`                                                        | Read accessible lists; create private lists      |
| `/api/v1/lists/:id`                                                    | Read list; owner rename/delete                   |
| `/api/v1/tasks`                                                        | Add, edit, complete/reopen, delete, reorder      |
| `/api/v1/connections`                                                  | List and revoke the user's AI connections        |
| `/api/mcp`                                                             | Stateless authenticated MCP HTTP transport       |
| `/.well-known/oauth-protected-resource/api/mcp`                        | MCP resource discovery                           |
| `/.well-known/oauth-authorization-server`                              | Authorization-server discovery                   |
| `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke` | Client registration, consent, tokens, revocation |

Website API mutations require a same-origin session. External MCP clients use bearer tokens scoped to the MCP resource. HTTP API bearer authentication for future mobile clients remains future work. An OpenAPI document has not been added yet.

## Migrations and deployment

Generate schema changes with Drizzle, review the SQL, and test against development before main. Use a direct connection for migrations. Do not modify Neon-managed tables. Application connections require TLS certificate verification.

Migrations are explicit operations, not part of request handling or automatic application builds. The initial migration was tested on development before being applied to the empty main database.

Build and deploy using the repository's configured Vercel project. `.vercelignore` excludes local credentials, fixture state, caches, and test screenshots. GitHub pushes to main also trigger the connected Vercel project. Do not promise preview branch isolation until automatic branch-per-preview configuration has been verified; currently main is the integration default and local development is isolated explicitly.

## Sharing endpoints

All sharing writes accept an `operationId` UUID for identical retries. Owner changes and leaving also require the current list `version`; stale versions return 409. Website mutations require the existing same-origin cookie session.

| Endpoint                                      | Method | Purpose                                                      |
| --------------------------------------------- | ------ | ------------------------------------------------------------ |
| `/api/v1/invitations`                         | GET    | Current recipient’s pending invitations                      |
| `/api/v1/invitations/:id`                     | POST   | Accept or decline with `accept: boolean`                     |
| `/api/v1/lists/:id/sharing`                   | GET    | Owner and editors; pending invitations visible only to owner |
| `/api/v1/lists/:id/invitations`               | POST   | Owner invites an existing Wuff email                         |
| `/api/v1/lists/:id/invitations/:invitationId` | DELETE | Owner cancels a pending invitation                           |
| `/api/v1/lists/:id/members/:userId`           | DELETE | Owner revokes editor access                                  |
| `/api/v1/lists/:id/leave`                     | POST   | Editor leaves list                                           |

Migration `0001_free_wild_pack.sql` adds nullable recipient/closed-state columns and two indexes. It preserves existing invitation columns and all list/task data. Legacy invitations without a recipient ID cannot be accepted through this flow. Reads use `lists:read`; sharing mutations require `lists:manage` and current application admission/membership. No new OAuth scope is required for existing connections.
