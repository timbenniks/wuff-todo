import OAuth2Server from "@node-oauth/oauth2-server";
import { and, eq } from "drizzle-orm";
import { database, oauthCodes, oauthTokens } from "@wuff/db";
import { mcpResource } from "@/lib/config";
import { digest, oauthRequest, oauthServer } from "@/lib/oauth";
export async function POST(request: Request) {
  try {
    if (
      !request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      throw new OAuth2Server.InvalidRequestError(
        "Use form-encoded parameters.",
      );
    const text = await request.text();
    if (text.length > 8192)
      throw new OAuth2Server.InvalidRequestError("Request too large.");
    const params = new URLSearchParams(text);
    for (const key of new Set(params.keys()))
      if (params.getAll(key).length !== 1)
        throw new OAuth2Server.InvalidRequestError("Duplicate parameter.");
    if (params.get("resource") !== mcpResource())
      throw new OAuth2Server.InvalidRequestError(
        "A matching resource is required.",
      );
    const db = database().db;
    const resource =
      params.get("grant_type") === "authorization_code"
        ? await db
            .select({ resource: oauthCodes.resource })
            .from(oauthCodes)
            .where(eq(oauthCodes.hash, digest(params.get("code") ?? "")))
        : await db
            .select({ resource: oauthTokens.resource })
            .from(oauthTokens)
            .where(
              and(
                eq(
                  oauthTokens.refreshHash,
                  digest(params.get("refresh_token") ?? ""),
                ),
                eq(oauthTokens.revoked, false),
              ),
            );
    if (resource[0]?.resource !== mcpResource())
      throw new OAuth2Server.InvalidGrantError("Invalid grant.");
    const token = await oauthServer().token(
      oauthRequest(request, Object.fromEntries(params)),
      new OAuth2Server.Response(),
    );
    return Response.json(
      {
        access_token: token.accessToken,
        token_type: "Bearer",
        expires_in: Math.max(
          0,
          Math.floor(
            (token.accessTokenExpiresAt!.getTime() - Date.now()) / 1000,
          ),
        ),
        refresh_token: token.refreshToken,
        scope: token.scope?.join(" "),
      },
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  } catch (error) {
    const known = error instanceof OAuth2Server.OAuthError;
    return Response.json(
      {
        error: known ? error.name : "server_error",
        error_description: known ? error.message : "Token exchange failed.",
      },
      {
        status: known ? error.code : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
