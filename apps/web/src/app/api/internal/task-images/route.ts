import { timingSafeEqual } from "node:crypto";
import { cleanupTaskImages } from "@wuff/domain";
import { failure, privateJson } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    return privateJson(await cleanupTaskImages());
  } catch (error) {
    return failure(error);
  }
}
