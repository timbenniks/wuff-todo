# Build a Wuff Empire module

A product is a module inside the existing monorepo and deployment. Todo and
Totake are the reference implementations. Start with the nearest module rather
than copying an entire app or adding a plugin loader.

## Ownership and entry points

| Layer                    | Product-owned source                                                | Empire responsibility                                                                                                   |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Manifest and tool policy | `packages/contracts/src/modules/<id>/manifest.ts`, `mcp-catalog.ts` | Client-safe installed registry in `packages/contracts/src/modules.ts`; validates IDs, routes, widgets, groups and tools |
| Contracts and rules      | `packages/contracts/src/modules/<id>/`                              | Actor/error/ID, account, notification and design contracts in `platform/`                                               |
| Database                 | `packages/db/src/modules/<id>/schema.ts`                            | `schema.ts` composes tables; one migration chain and connection                                                         |
| Domain                   | `packages/domain/src/modules/<id>/`                                 | Shared admission, transactions, notification delivery and settings orchestration in `platform/`                         |
| Shared web/native UI     | `packages/ui/src/modules/<id>/`                                     | UI primitives, account-pinned API and platform runtime                                                                  |
| Website                  | `apps/web/src/modules/<id>/pages`, `api`, `web`                     | Thin Next route entry points preserve public URLs and framework configuration                                           |
| MCP                      | Product `mcp.ts` and `mcp-app.ts`                                   | Transport, authenticated actor, scope/tool filtering, resource packaging and shared embedded controls                   |
| Dashboard                | Product `dashboard.tsx`                                             | Layout and choice filtering; typed UI registry in `apps/web/src/modules/ui.ts`                                          |

The public `@wuff/contracts` and `@wuff/domain` barrels remain compatibility
surfaces. New module adapters should use explicit product subpaths where practical.
Do not move server code into a client-safe registry. Shared UI must not import the
server registry or database package. Product UI imports real `@wuff/ui` primitives.

## Add a product

1. Choose a stable lowercase ID and routes. Add its manifest, schemas and tool
   policy. Declare navigation, settings links, dashboard widget IDs/defaults,
   approved theme, permission labels and tool groups. Registration rejects
   duplicate ownership and reserved routes. Module tools cannot become mandatory
   platform controls or request undeclared scopes.
2. Add the product to `packages/contracts/src/modules.ts`. Register actual UI
   components in `apps/web/src/modules/ui.ts` and server MCP registration in
   `apps/web/src/modules/server.ts`. The typed registries require an entry for
   every installed product. The manifest contains no React or database imports.
3. Implement authorized domain operations and product-owned tables. Export schema
   definitions through the shared database composition entry point. Keep the single
   Drizzle migration history; no migrations on page load or on an app switch.
   Schema changes need their normal migration review and execution authorization.
4. Add thin filesystem routes for Next.js and preserve explicit framework exports.
   Settings panels belong to the product; the global navigation discovers their
   manifest links. Implement the HTTP/native adapters and MCP tools against the
   same domain services. Register native action adapters in `apps/web/src/modules/native.ts`. The
   bearer-only native transport checks identity/audience/account pinning before
   dispatch; duplicate actions are rejected. Register embedded renderers in
   `modules/mcp-ui.ts` when an
   interactive MCP view is appropriate; complete tools remain available without it.
5. If the product schedules notifications, contribute reconciliation and scheduling
   through `packages/domain/src/platform/module-services.ts`. Product code owns
   repeat rules/content and job tables; the platform owns devices, transport and
   global pause/privacy. Extend persisted per-app pause storage/contracts with a
   reviewed migration when adding a new notification-producing app; current
   columns are intentionally still Todo/Totake. Check pause, resume, stale callback
   and device isolation. Shared services must not invent medicine or task actions.
6. Run registry, unit, API/MCP/native and relevant browser checks. Record explicit
   consent/revocation and MCP UI decisions under the surface contract. Update this
   guide when an extension point changes, and keep the feature PR current.

## User choices are independent

Show app controls launcher/navigation visibility. Dashboard controls its widgets.
Tool choices narrow each MCP connection's actual OAuth grant. Notification pauses
are enforced on the server. None implies another. Hidden apps retain authorized
direct links, data and reminder delivery; settings remain reachable for recovery.
There is no new destructive uninstall or activate/deactivate lifecycle in this
refactor. A later deactivation capability must define background-work and data
retention behavior and expose equivalent authorized API/MCP operations.

New optional tools stay off after an explicit tool selection. Enabling a module
never broadens consent, refresh permissions or provider access. Module registrars
receive an ownership-filtered context; current scope checks and disabled cached
calls remain the platform's responsibility. Never register tools directly on the
raw server to bypass that boundary.

## Design and compatibility

Use the shared design tokens, controls, full-width layouts, fonts and accessibility
rules. The manifest records an approved default palette; existing Todo list-owned
themes still take precedence inside Todo. Adding a manifest is not a license to
replace global CSS or invent arbitrary theme colors. Preserve module-local design
choices, including Totake's screens and recording workflow.

Existing native navigation remains Todo-focused. Shared product UI and native
HTTP capabilities remain available; installing a web module does not automatically
add a native navigation destination or prove device behavior. Cross-product
features call a deliberate platform orchestrator or public service, never reach
into another product's private UI or data internals.
