import {
  deliverReminder,
  verifyReminderCallback,
  recoverReminderScheduling,
} from "@wuff/domain";
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
      new URL("/api/internal/reminders", appOrigin()).href,
    ))
  )
    return new Response(null, { status: 401 });
  try {
    await deliverReminder(JSON.parse(body));
    return privateJson({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
// Once-daily recovery for pending scheduling, never a per-minute poll.
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response(null, { status: 401 });
  await recoverReminderScheduling();
  return privateJson({ ok: true });
}
