import OAuth2Server from "@node-oauth/oauth2-server";
import { z } from "zod";
import { webActor } from "@/lib/auth/server";
import { sameOrigin, jsonInput, failure } from "@/lib/http";
import { authorizationDetails, oauthServer } from "@/lib/oauth";
import { appOrigin, mcpResource } from "@/lib/config";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await webActor(),
      { query, accept } = z
        .object({ query: z.string().max(8192), accept: z.boolean() })
        .parse(await jsonInput(request));
    const params = new URLSearchParams(query);
    await authorizationDetails(params);
    if (!accept) {
      const redirect = new URL(params.get("redirect_uri")!);
      redirect.searchParams.set("error", "access_denied");
      redirect.searchParams.set("state", params.get("state")!);
      redirect.searchParams.set("iss", appOrigin());
      return Response.json({ redirect: redirect.href });
    }
    const response = new OAuth2Server.Response();
    await oauthServer().authorize(
      new OAuth2Server.Request({
        method: "GET",
        headers: {},
        query: Object.fromEntries(params),
      }),
      response,
      {
        authenticateHandler: {
          handle: async () => ({ id: actor.id, resource: mcpResource() }),
        },
      },
    );
    const redirect = new URL(response.headers!.location);
    redirect.searchParams.set("iss", appOrigin());
    return Response.json(
      { redirect: redirect.href },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
