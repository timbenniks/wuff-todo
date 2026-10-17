import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { after } from "next/server";
import { processGithubJobs } from "@wuff/domain";
import { createMcpServer } from "@/lib/mcp";
import { bearerActor, unauthorizedMcp } from "@/lib/oauth";
import { boundedBody } from "@/lib/bounded-body";
import { failure } from "@/lib/http";
import { taskImageLimit } from "@wuff/contracts";
import { appOrigin } from "@/lib/config";
export const runtime = "nodejs";
export const maxDuration = 120;
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
  try {
    const bytes = await boundedBody(
      request,
      4 * Math.ceil(taskImageLimit / 3) + 16_384,
    );
    request = new Request(request, { body: bytes });
  } catch (error) {
    return failure(error);
  }
  const server = createMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    const body = await response.text();
    after(() => processGithubJobs());
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
