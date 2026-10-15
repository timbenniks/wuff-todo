import { z } from "zod";
import { jsonInput, failure } from "@/lib/http";
import { registerClient, validateRedirectUri } from "@/lib/oauth";
const schema = z.object({
  client_name: z.string().trim().min(1).max(100).default("AI client"),
  redirect_uris: z.array(z.url().refine(validateRedirectUri)).min(1).max(10),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .optional(),
  response_types: z.array(z.literal("code")).optional(),
});
export async function POST(request: Request) {
  try {
    const data = schema.parse(await jsonInput(request));
    return Response.json(
      await registerClient(data.client_name, data.redirect_uris),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
