import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import { bearerActor, unauthorizedMcp } from "@/lib/oauth";
import { appOrigin } from "@/lib/config";
export const runtime = "nodejs";
export const maxDuration = 30;
async function handle(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== appOrigin())
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  let actor;
  try {
    actor = await bearerActor(request);
  } catch {
    return unauthorizedMcp();
  }
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const server = createMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await server.close();
  }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
