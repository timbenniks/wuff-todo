import { deliverTotake, verifyReminderCallback } from "@wuff/domain";
import { failure, privateJson } from "@/lib/http";
import { appOrigin } from "@/lib/config";
export const maxDuration = 60;
export async function POST(request: Request) {
  const body = await request.text();
  if (
    body.length > 4096 ||
    !(await verifyReminderCallback(
      request.headers.get("upstash-signature") ?? "",
      body,
      new URL("/api/internal/totake", appOrigin()).href,
    ))
  )
    return new Response(null, { status: 401 });
  try {
    await deliverTotake(JSON.parse(body));
    return privateJson({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
