import { after } from "next/server";
import { githubWebhook, processGithubJobs } from "@wuff/domain";
import { failure, privateJson } from "@/lib/http";
export const maxDuration = 120;
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    // Stream with a byte bound; Content-Length is not trusted.
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const result = await githubWebhook(
      body,
      request.headers.get("x-hub-signature-256") ?? "",
      request.headers.get("x-github-delivery") ?? "",
      request.headers.get("x-github-event") ?? "",
    );
    after(() => processGithubJobs());
    return privateJson(result);
  } catch (e) {
    return failure(e);
  }
}
