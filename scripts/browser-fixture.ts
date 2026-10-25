// A loopback-only test host. Never imported into or deployed with the app.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { build } from "esbuild";
import { createList, createTask, deleteList, getList } from "@wuff/domain";
import { scopes } from "@wuff/contracts";
import { database } from "@wuff/db";

const origin = "http://localhost:3000";
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
  title: "Weekend things",
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
const registration = await (
  await fetch(`${origin}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Local browser fixture",
      redirect_uris: ["http://127.0.0.1:4173/callback"],
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
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/login") {
      res.writeHead(302, {
        "Set-Cookie": cookies,
        Location: `${origin}/lists`,
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
            name: empireView ? "show_empire_settings" : "show_list",
            arguments: empireView ? {} : { listId: list.id },
          }),
        ),
      );
    } else if (req.url === "/mcp" && req.method === "POST") {
      let text = "";
      for await (const chunk of req) text += chunk;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(await rpc("tools/call", JSON.parse(text))));
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
server.listen(4173, "127.0.0.1", () =>
  console.log(
    "Local test host ready on http://localhost:4173; /login restores the synthetic web session.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    server.close();
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
