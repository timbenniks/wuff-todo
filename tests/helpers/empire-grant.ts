import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { tauriClientId, tauriRedirectUri } from "@wuff/contracts";
export const fixtureOrigin = "http://localhost:3000";
export async function empireGrant(
  cookie: string,
  scope: string,
  native = false,
  existing?: { clientId: string; redirectUri: string },
) {
  if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
    throw Error("Development only");
  const origin = fixtureOrigin,
    resource = origin + (native ? "/api/mobile" : "/api/mcp");
  let clientId: string = tauriClientId,
    redirectUri: string = tauriRedirectUri;
  if (native) assert.equal((await fetch(origin + "/oauth/tauri")).status, 200);
  else if (existing) {
    clientId = existing.clientId;
    redirectUri = existing.redirectUri;
  } else {
    const response = await fetch(origin + "/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Empire settings fixture",
        redirect_uris: ["http://127.0.0.1:4173/callback"],
      }),
    });
    assert.equal(response.status, 201);
    const registered = await response.json();
    clientId = registered.client_id;
    redirectUri = registered.redirect_uris[0];
  }
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    state: randomBytes(16).toString("hex"),
    scope,
    resource,
  });
  const consent = await fetch(origin + "/oauth/authorize?" + query, {
    headers: { Cookie: cookie },
  });
  assert.equal(consent.status, 200);
  if (scope.startsWith("empire:")) {
    const html = await consent.text();
    assert(html.includes("AI-client connection permissions"));
    assert.equal(
      html.includes("disconnect your AI clients"),
      scope.split(" ").includes("empire:manage"),
    );
    assert(!html.includes("Read your accessible lists and tasks"));
  }
  const decision = await fetch(origin + "/oauth/authorize/decision", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: query.toString(), accept: true }),
  });
  assert.equal(decision.status, 200);
  const redirect = new URL((await decision.json()).redirect);
  const response = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code: redirect.searchParams.get("code")!,
      code_verifier: verifier,
      resource,
    }),
  });
  assert.equal(response.status, 200);
  const token = await response.json();
  return { ...token, clientId, native, resource } as {
    access_token: string;
    refresh_token: string;
    scope: string;
    clientId: string;
    native: boolean;
    resource: string;
  };
}
export async function empireMcp(
  token: string,
  name: string,
  args: unknown = {},
) {
  const response = await fetch(fixtureOrigin + "/api/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await response.text();
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)))
        .find((item) => item.result || item.error)
    : JSON.parse(text);
  return {
    status: response.status,
    result: payload?.result,
    error: payload?.error,
  };
}
