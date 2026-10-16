# Private images in task notes

Updated: October 16, 2026

## Scope and experience

Task notes support private still images alongside formatted text. The website keeps one Tiptap editor: use Add image, paste an image, or drop a file at the writing position. A successful upload inserts a preview into the draft; Save notes commits it. Cancel leaves the saved note unchanged. Selecting an image exposes its description and Remove image. Existing text-formatting controls, inline names, drag handles, live updates and version conflicts remain unchanged.

PNG, JPEG and WebP inputs are limited to 3 MiB per image and 20 saved or unexpired draft uploads per task. SVG, animated/multipage images and undecodable bytes are rejected independently of the file name/MIME. The server limits decoding to 40 million pixels, applies orientation, fits the result within 2048 × 2048 without enlargement, and re-encodes to WebP with original metadata removed. This pass does not add general file attachments, remote image fetching, covers, subtasks, dates, or offline storage.

Markdown remains canonical: `![Description](/api/v1/attachments/UUID)`. Only this exact application image path renders as an image. Third-party URLs, raw HTML, data URLs, query parameters and other paths cannot cause image loads. The visual editor supports these internal images directly; unsupported external syntax still uses the preserved-content block. Descriptions are user content and are escaped.

## Storage and permissions

Vercel Blob stores bytes in private Frankfurt stores. Neon holds attachment IDs, image dimensions/size, digest-bound storage paths, upload ownership, parent list/task, and lifecycle state. Paths, Blob credentials and Blob URLs are not returned to clients or written into notes. The Blob SDK is configured with the environment-specific server-only token explicitly; browser bundles contain neither storage nor domain implementation.

Every upload/read checks enabled Wuff admission and current list access through shared domain services. Uploads require `tasks:write`; reads require `lists:read`. Owners and accepted editors can upload to active tasks. Archived images remain readable, while archived uploads/note changes are refused. A draft image can be read and committed only by its uploader; once saved, current members can read it. A reference can only be saved into its own task, never transplanted into another task/list. Revocation blocks subsequent image reads, including with an existing OAuth grant. Bytes already downloaded cannot be recalled.

`GET /api/v1/attachments/:id` authenticates the web session, fetches private Blob content server-side, rechecks authorization, and streams WebP with `private, no-store`, CDN no-store, same-origin resource policy and nosniff headers. It never redirects or issues a client read token. There is no public-image fallback. Preview deployments have no image store until explicitly isolated/configured.

## Reservation, save and cleanup

Uploads use an actor-scoped operation UUID and the current list version. A short transaction checks the task, active list, version and quota, and reserves a digest-bound immutable storage path. Storage I/O occurs outside the database transaction. Identical retries reuse the reservation/path; changed bytes with the same operation UUID are refused. Admission, membership, parent existence, archive and expiry are checked again when finishing. An upload alone does not change saved content or advance the list version.

Saving notes validates all referenced images and attaches them atomically with the task update, under the existing list/version lock. Removing a saved reference retires it immediately, so reads fail before storage cleanup. Existing Realtime list-version invalidation delivers saved image references across clients; it does not publish draft uploads. Other task changes preserve content and images.

Uncommitted reservations expire after 24 hours. Deleting a task/list sets attachment parent references to null, preserving storage cleanup records. The daily authenticated Vercel cron at `/api/internal/task-images` processes up to 100 eligible rows: expired drafts, removed images, and deleted parents. Deleted-parent/retired rows must be at least an hour old. Cleanup first retires a row, then deletes its object; the tombstone stays at least one hour. A later pass deletes the object again before removing metadata, covering delayed in-flight uploads. Failed deletions keep their records for retry. The handler requires the server-only `CRON_SECRET`; unconfigured/invalid credentials cannot trigger cleanup. Manual operators can invoke the same protected endpoint without exposing the secret.

Drafts stay in memory and can expire or be lost when leaving the page. No offline queue or durable browser image cache is added. A failed/uncertain upload is visibly unconfirmed; retrying the same bytes in the same editor reuses its operation/version. Definitive refusals require fixing the error/reloading current state.

## API, MCP and embedded App

- `POST /api/v1/attachments?listId=…&taskId=…&version=…&operationId=…`: same-origin web session; raw image request body, bounded to 3 MiB even without Content-Length. Returns image ID, dimensions/size and a Markdown reference.
- Existing task `PATCH` / MCP `update_task`: save Markdown using the current list version and operation UUID. Snapshots add `task.images` metadata for saved images.
- MCP `upload_task_image`: the same upload domain operation, taking standard base64 without a data-URL prefix. Returns a reference for a subsequent `update_task`; it does not silently replace notes. Clients need to support sending bytes; remote URLs/host-specific file import are outside this pass.
- MCP `get_task_image`: reads an authorized attachment and returns native MCP image content plus public metadata. No browser session or public URL is required.
- MCP request bodies are bounded to the encoded image limit plus framing; input and normalized output are kept below Vercel function request/response limits.

The embedded App keeps its existing Markdown textarea/preview rather than bundling Tiptap. It adds an image chooser and reads private images through the authenticated MCP tool into in-memory data URLs. It does not fetch web session routes from the sandbox or expand its external CSP allowlist. Read promises are scoped to the current rendered list/account; new authoritative results clear them. Stale results cannot insert an image into a replacement view. Compatibility with named hosts remains a separate check from the local SDK host.

## Operations

- Existing Vercel-managed Neon project and branches are unchanged.
- Development Blob: `wuff-todo-images-dev`, `store_BqAoI1euGSWVESLe`, private, `fra1`, Development environment only.
- Production Blob: `wuff-todo-images-production`, `store_1v2rmdpMrlRE0hPb`, private, `fra1`, Production environment only.
- `BLOB_READ_WRITE_TOKEN` differs between the ignored local development and production environment files. Never print it. `CRON_SECRET` is also server-only; production is set through Vercel CLI.
- Vercel CLI `blob create-store` automatically pulls Development environment variables after connecting. Provision from an isolated linked working directory to avoid replacing local development database/auth variables. On this machine those variables were restored from the explicitly selected isolated Neon branch and checked before any migration/test writes. Do not use a general environment pull as a development database configuration.
- Migration `0004_thick_harrier.sql` adds only the application attachment table and indexes/FKs. Apply to isolated development first, then production through direct connections before deploying snapshot readers. No auth-managed tables are changed. A rollback can retain this additive table while running the previous app; preserve stored notes/files.

## Sources

- [Vercel private storage](https://vercel.com/docs/vercel-blob/private-storage)
- [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [Blob CLI](https://vercel.com/docs/cli/blob)
- [Tiptap Markdown extension integration](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension)

## Verification

Implementation verification and deployment are in progress. Do not treat the storage decision or a build alone as proof of browser, production, or named-host MCP behaviour.
