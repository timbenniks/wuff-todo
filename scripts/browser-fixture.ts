// A loopback-only test host. Never imported into or deployed with the app.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomBytes, createHash } from "node:crypto";
import { build } from "esbuild";
import { createList, createTask, deleteList, getList } from "@wuff/domain";
import { scopes } from "@wuff/contracts";
import { database, notes, noteAssets } from "@wuff/db";
import { eq, and, like } from "drizzle-orm";
import {
  createNote,
  updateNote,
  uploadNoteImage,
} from "@wuff/domain/modules/notes";
import { eraseTaskImage } from "../packages/domain/src/platform/image-storage";

const fixturePort = Number(process.env.WUFF_FIXTURE_PORT ?? 4173);
if (!Number.isInteger(fixturePort) || fixturePort < 1024 || fixturePort > 65535)
  throw new Error("Choose a valid test host port");
// Fail before creating synthetic data when another task already owns the port.
const preflight = createServer();
await new Promise<void>((resolve, reject) => {
  preflight.once("error", reject);
  preflight.listen(fixturePort, "127.0.0.1", () =>
    preflight.close((error) => (error ? reject(error) : resolve())),
  );
});
const origin = "http://localhost:3000";
const notesView = process.env.WUFF_FIXTURE_VIEW === "notes";
const totakeView = process.env.WUFF_FIXTURE_VIEW === "totake";
const empireView = process.env.WUFF_FIXTURE_VIEW === "empire";
if (process.env.WUFF_ORIGIN !== origin)
  throw new Error("This fixture only runs against local development.");
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const response = await fetch(`${origin}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ email: user.email, password: user.password }),
});
if (!response.ok) throw new Error("Fixture sign-in failed");
const cookies = response.headers.getSetCookie(),
  cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
const actor = { id: user.id, scopes };
let list = await createList(actor, {
  title: notesView ? "Wuff Notes browser · Todo destination" : "Weekend things",
  operationId: crypto.randomUUID(),
});
for (const title of [
  "Pick up groceries",
  "Book a table for Saturday",
  "Take a long walk",
])
  list = await createTask(actor, {
    listId: list.id,
    version: list.version,
    title,
    operationId: crypto.randomUUID(),
  });
if (notesView) {
  const reference = await createNote(actor, {
    title: "Wuff Notes browser · A place for ideas",
    content:
      "## Small things, collected\n\nA notebook for thoughts worth keeping.",
    tags: ["ideas"],
    operationId: crypto.randomUUID(),
  });
  let board = await createNote(actor, {
    title: "Wuff Notes browser · Autumn studio",
    mode: "moodboard",
    theme: "sand",
    content: "A calm corner for the next creative project.",
    tags: ["studio", "inspiration"],
    operationId: crypto.randomUUID(),
  });
  for (const body of [
    {
      kind: "text",
      title: "The feeling",
      text: "Warm light. Quiet mornings. Space to make something.",
    },
    { kind: "link", title: "Color inspiration", url: "https://example.com" },
    { kind: "note", targetId: reference.id },
  ] as const)
    board = (await updateNote(actor, {
      noteId: board.id,
      version: board.version,
      operationId: crypto.randomUUID(),
      change: { action: "add_card", body },
    })) as typeof board;
  const require = createRequire(
    new URL("../packages/domain/package.json", import.meta.url),
  );
  const picture = await require("sharp")({
    create: { width: 600, height: 400, channels: 3, background: "#9caa93" },
  })
    .png()
    .toBuffer();
  const uploaded = await uploadNoteImage(actor, {
    noteId: board.id,
    version: board.version,
    operationId: crypto.randomUUID(),
    imageBase64: picture.toString("base64"),
  });
  board = uploaded.note;
  board = (await updateNote(actor, {
    noteId: board.id,
    version: board.version,
    operationId: crypto.randomUUID(),
    change: {
      action: "add_card",
      body: {
        kind: "image",
        assetId: uploaded.image.id,
        caption: "A quiet sage palette",
      },
    },
  })) as typeof board;
  await updateNote(actor, {
    noteId: board.id,
    version: board.version,
    operationId: crypto.randomUUID(),
    change: {
      action: "preference",
      preferenceVersion: 0,
      pinned: true,
      archived: false,
    },
  });
}
const registration = await (
  await fetch(`${origin}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Local browser fixture",
      redirect_uris: [`http://127.0.0.1:${fixturePort}/callback`],
    }),
  })
).json();
const verifier = randomBytes(32).toString("base64url");
const query = new URLSearchParams({
  client_id: registration.client_id,
  redirect_uri: registration.redirect_uris[0],
  response_type: "code",
  scope: scopes.join(" "),
  state: randomBytes(24).toString("hex"),
  resource: `${origin}/api/mcp`,
  code_challenge_method: "S256",
  code_challenge: createHash("sha256").update(verifier).digest("base64url"),
});
const decision = await (
  await fetch(`${origin}/oauth/authorize/decision`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: query.toString(), accept: true }),
  })
).json();
const token = await (
  await fetch(`${origin}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: registration.client_id,
      grant_type: "authorization_code",
      redirect_uri: registration.redirect_uris[0],
      code: new URL(decision.redirect).searchParams.get("code")!,
      code_verifier: verifier,
      resource: `${origin}/api/mcp`,
    }),
  })
).json();
if (!token.access_token) throw new Error("Fixture OAuth grant failed");
let id = 0;
async function rpc(method: string, params: unknown) {
  const r = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  if (!r.ok) throw new Error("Fixture MCP request failed");
  return (await r.json()).result;
}
const resource = await rpc("resources/read", { uri: "ui://wuff/lists.html" });
const bundle = await build({
  entryPoints: ["tests/mcp-host.fixture.ts"],
  bundle: true,
  minify: true,
  write: false,
  format: "esm",
});
let droppedNoteRequest: string | null = null;
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/login") {
      res.writeHead(302, {
        "Set-Cookie": cookies,
        Location: `${origin}/${notesView ? "notes" : "lists"}`,
        "Cache-Control": "no-store",
      });
      res.end();
    } else if (req.url === "/app-html") {
      res.setHeader("Content-Type", "text/html");
      res.end(resource.contents[0].text);
    } else if (req.url === "/host.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(bundle.outputFiles[0].text);
    } else if (req.url === "/bootstrap") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          await rpc("tools/call", {
            name: notesView
              ? "show_notes"
              : totakeView
                ? "show_totake"
                : empireView
                  ? "show_empire_settings"
                  : "show_list",
            arguments:
              notesView || empireView || totakeView ? {} : { listId: list.id },
          }),
        ),
      );
    } else if (req.url === "/mcp" && req.method === "POST") {
      let text = "";
      for await (const chunk of req) text += chunk;
      res.setHeader("Content-Type", "application/json");
      const params = JSON.parse(text),
        result = await rpc("tools/call", params);
      if (
        notesView &&
        process.env.WUFF_FIXTURE_DROP_NOTE_REPLY === "1" &&
        params.name === "update_note"
      ) {
        const { _meta, ...args } = params.arguments ?? {},
          fingerprint = JSON.stringify(args);
        if (!droppedNoteRequest && !result.isError) {
          droppedNoteRequest = fingerprint;
          console.log(
            "Committed synthetic Notes request; intentionally lost its first reply.",
          );
          res.end(
            JSON.stringify({
              isError: true,
              structuredContent: { error: { code: "internal_error" } },
              content: [
                {
                  type: "text",
                  text: "Test host lost the committed reply. Retry the same request.",
                },
              ],
            }),
          );
          return;
        }
        if (droppedNoteRequest === fingerprint)
          console.log("Identical Notes retry confirmed by the SDK host.");
      }
      res.end(JSON.stringify(result));
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><title>Wuff MCP App test host</title><body style="font:16px system-ui;background:#e7f0f8;padding:32px"><h1>MCP App integration test</h1><p>This local host uses the MCP Apps SDK and the authenticated Wuff server.</p><iframe title="Wuff Todo MCP App" sandbox="allow-scripts" style="width:min(100%,600px);height:600px;border:0;border-radius:16px"></iframe><script type="module" src="/host.js"></script></body></html>',
      );
    }
  } catch {
    res.writeHead(500);
    res.end("Fixture request failed.");
  }
});
server.listen(fixturePort, "127.0.0.1", () =>
  console.log(
    `Local test host ready on http://localhost:${fixturePort}; /login restores the synthetic web session.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    server.close();
    if (notesView) {
      const owned = await database()
        .db.select()
        .from(notes)
        .where(
          and(
            eq(notes.ownerId, user.id),
            like(notes.title, "Wuff Notes browser%"),
          ),
        );
      for (const note of owned) {
        for (const asset of await database()
          .db.select()
          .from(noteAssets)
          .where(eq(noteAssets.noteId, note.id)))
          await eraseTaskImage(asset.pathname);
        await database().db.delete(notes).where(eq(notes.id, note.id));
      }
    }
    const current = await getList(actor, list.id);
    await deleteList(actor, {
      listId: list.id,
      version: current.version,
      operationId: crypto.randomUUID(),
    });
    await fetch(`${origin}/api/v1/connections`, {
      method: "DELETE",
      headers: {
        Cookie: cookieHeader,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId: registration.client_id }),
    });
    await database().pool.end();
    process.exit(0);
  });
