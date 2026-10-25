import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { webActor } from "@/lib/auth/server";
import { getDashboard, updateDashboard } from "@wuff/domain";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    return privateJson(
      await getDashboard(await webActor(), {
        today: q.get("today"),
        ...(q.has("limit") ? { limit: Number(q.get("limit")) } : {}),
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await updateDashboard(await webActor(), await jsonInput(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
