import { timingSafeEqual } from "node:crypto";
import { reconcileGithub } from "@wuff/domain";
import { failure, privateJson } from "@/lib/http";
export const maxDuration = 120;
export async function GET(request: Request) {
  const a = Buffer.from(request.headers.get("authorization") ?? ""),
    b = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  if (
    !process.env.CRON_SECRET ||
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  )
    return new Response(null, { status: 401 });
  try {
    return privateJson(await reconcileGithub());
  } catch (e) {
    return failure(e);
  }
}
