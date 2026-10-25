import OAuth2Server from "@node-oauth/oauth2-server";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import {
  database,
  oauthClients,
  oauthCodes,
  oauthTokens,
  users,
} from "@wuff/db";
import { AppError, scopes } from "@wuff/contracts";
import { appOrigin, mcpResource } from "./config";
import {
  firstPartyRedirect,
  nativeAllowedScopes,
  validResourceClient,
} from "./native-policy";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
const db = () => database().db;
async function admitted(id: string) {
  const [user] = await db()
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.enabled, true)));
  return Boolean(user);
}
async function clientById(id: string) {
  const [client] = await db()
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.id, id));
  return client
    ? {
        id: client.id,
        name: client.name,
        redirectUris: client.redirectUris,
        grants: ["authorization_code", "refresh_token"],
      }
    : null;
}

export function oauthServer(resource = mcpResource()) {
  const model: OAuth2Server.AuthorizationCodeModel &
    OAuth2Server.RefreshTokenModel = {
    getClient: async (id, secret) =>
      secret || !validResourceClient(id, resource, appOrigin())
        ? null
        : clientById(id),
    generateAccessToken: async () => randomToken(),
    generateRefreshToken: async () => randomToken(),
    generateAuthorizationCode: async () => randomToken(),
    validateScope: async (user, _client, requested) => {
      if (!(await admitted(user.id))) return false;
      return requested?.length &&
        requested.every((s) =>
          (resource === mcpResource() ? scopes : nativeAllowedScopes).some(
            (allowed) => allowed === s,
          ),
        ) &&
        (requested.includes("lists:read") ||
          (resource === mcpResource() &&
            [
              "empire:read",
              "totake:read",
              "notes:read",
              "notifications:read",
            ].some((s) => requested.includes(s))))
        ? requested
        : false;
    },
    saveAuthorizationCode: async (code, client, user) => {
      await db()
        .insert(oauthCodes)
        .values({
          hash: digest(code.authorizationCode),
          clientId: client.id,
          userId: user.id,
          redirectUri: code.redirectUri,
          scope: code.scope ?? [],
          challenge: code.codeChallenge!,
          resource: user.resource,
          expiresAt: code.expiresAt,
        });
      return { ...code, client, user };
    },
    getAuthorizationCode: async (code) => {
      const [row] = await db()
        .select()
        .from(oauthCodes)
        .where(eq(oauthCodes.hash, digest(code)));
      if (!row || !(await admitted(row.userId))) return null;
      return {
        authorizationCode: code,
        expiresAt: row.expiresAt,
        redirectUri: row.redirectUri,
        scope: row.scope,
        codeChallenge: row.challenge,
        codeChallengeMethod: "S256",
        client: (await clientById(row.clientId))!,
        user: { id: row.userId, resource: row.resource },
      };
    },
    revokeAuthorizationCode: async (code) =>
      (
        await db()
          .delete(oauthCodes)
          .where(eq(oauthCodes.hash, digest(code.authorizationCode)))
          .returning()
      ).length === 1,
    saveToken: async (token, client, user) => {
      await db()
        .insert(oauthTokens)
        .values({
          accessHash: digest(token.accessToken),
          refreshHash: digest(token.refreshToken!),
          clientId: client.id,
          userId: user.id,
          scope: token.scope ?? [],
          resource: user.resource,
          issuer: appOrigin(),
          accessExpiresAt: token.accessTokenExpiresAt!,
          refreshExpiresAt: token.refreshTokenExpiresAt!,
        });
      return {
        ...token,
        accessToken: token.accessToken as string,
        client,
        user,
      };
    },
    getAccessToken: async (token) => {
      const [row] = await db()
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.accessHash, digest(token)),
            eq(oauthTokens.revoked, false),
            eq(oauthTokens.resource, resource),
            eq(oauthTokens.issuer, appOrigin()),
          ),
        );
      if (!row || !(await admitted(row.userId))) return null;
      return {
        accessToken: token,
        accessTokenExpiresAt: row.accessExpiresAt,
        scope: row.scope,
        client: (await clientById(row.clientId))!,
        user: { id: row.userId, resource: row.resource },
      };
    },
    getRefreshToken: async (token) => {
      const [row] = await db()
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.refreshHash, digest(token)),
            eq(oauthTokens.revoked, false),
            eq(oauthTokens.resource, resource),
            eq(oauthTokens.issuer, appOrigin()),
          ),
        );
      if (!row || !(await admitted(row.userId))) return null;
      return {
        refreshToken: token,
        refreshTokenExpiresAt: row.refreshExpiresAt,
        scope: row.scope,
        client: (await clientById(row.clientId))!,
        user: { id: row.userId, resource: row.resource },
      };
    },
    revokeToken: async (token) =>
      (
        await db()
          .update(oauthTokens)
          .set({ revoked: true })
          .where(
            and(
              eq(oauthTokens.refreshHash, digest(token.refreshToken)),
              eq(oauthTokens.revoked, false),
            ),
          )
          .returning()
      ).length === 1,
    verifyScope: async (token, requested) =>
      requested.every((s) => token.scope?.includes(s)),
  };
  return new OAuth2Server({
    model,
    accessTokenLifetime: 900,
    refreshTokenLifetime: 60 * 60 * 24 * 30,
    authorizationCodeLifetime: 120,
    requirePKCE: true,
    requireClientAuthentication: {
      authorization_code: false,
      refresh_token: false,
    },
  });
}

export function oauthRequest(request: Request, body?: Record<string, unknown>) {
  return new OAuth2Server.Request({
    method: request.method,
    headers: Object.fromEntries(request.headers),
    query: Object.fromEntries(new URL(request.url).searchParams),
    body,
  });
}
export async function bearerActor(request: Request, resource = mcpResource()) {
  const token = await oauthServer(resource).authenticate(
    oauthRequest(request),
    new OAuth2Server.Response(),
  );
  return {
    id: token.user.id as string,
    scopes: token.scope ?? [],
    ...(resource === mcpResource()
      ? { mcpClientId: token.client.id as string }
      : {}),
  };
}
export async function authorizationDetails(params: URLSearchParams) {
  for (const key of new Set(params.keys()))
    if (params.getAll(key).length !== 1)
      throw new AppError(
        "invalid_request",
        "Duplicate authorization parameter.",
      );
  const client = await clientById(params.get("client_id") ?? "");
  if (
    !client ||
    !client.redirectUris.includes(params.get("redirect_uri") ?? "")
  )
    throw new AppError("invalid_client", "Unknown client or redirect address.");
  if (
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256" ||
    !/^[\w-]{43}$/.test(params.get("code_challenge") ?? "")
  )
    throw new AppError(
      "invalid_request",
      "Authorization requires an S256 PKCE challenge.",
    );
  if (!params.get("state") || params.get("state")!.length > 1024)
    throw new AppError(
      "invalid_request",
      "A valid state parameter is required.",
    );
  const resource = params.get("resource") ?? "";
  if (
    !validResourceClient(client.id, resource, appOrigin()) ||
    (firstPartyRedirect(client.id) !== null &&
      params.get("redirect_uri") !== firstPartyRedirect(client.id))
  )
    throw new AppError(
      "invalid_target",
      "This authorization is for a different resource.",
    );
  const requested = authorizationScopes(params.get("scope"), client.id);
  return { client, requested, resource };
}

// OAuth permits an omitted scope. ChatGPT's connection setup uses this path;
// consent must display the same bounded defaults that are saved in the grant.
export function authorizationScopes(scope: string | null, clientId: string) {
  const requested =
    scope === null && firstPartyRedirect(clientId) === null
      ? ["lists:read", "tasks:write", "lists:manage"]
      : (scope ?? "").split(" ").filter(Boolean);
  if (
    !(
      requested.includes("lists:read") ||
      (firstPartyRedirect(clientId) === null &&
        ["empire:read", "totake:read", "notes:read", "notifications:read"].some(
          (s) => requested.includes(s),
        ))
    ) ||
    requested.some(
      (s) =>
        !(
          firstPartyRedirect(clientId) !== null ? nativeAllowedScopes : scopes
        ).some((allowed) => allowed === s),
    )
  )
    throw new AppError("invalid_scope", "Choose supported Wuff permissions.");
  return requested;
}
export function authorizationMetadata() {
  const origin = appOrigin();
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: scopes,
  };
}
export function protectedMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [appOrigin()],
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
  };
}
export function unauthorizedMcp() {
  return Response.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${appOrigin()}/.well-known/oauth-protected-resource/api/mcp"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

export function validateRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}
export async function registerClient(name: string, redirectUris: string[]) {
  // Persistent global ceiling is sufficient for the initial private beta.
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('wuff:client-registration', 0))`,
    );
    const recent = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(oauthClients)
      .where(gt(oauthClients.createdAt, new Date(Date.now() - 3600_000)));
    if (recent[0].count >= 100)
      throw new AppError("rate_limited", "Please try registering later.", 429);
    const id = crypto.randomUUID();
    await tx.insert(oauthClients).values({ id, name, redirectUris });
    return {
      client_id: id,
      client_name: name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  });
}
