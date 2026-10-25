import { getTotakeSummary } from "@wuff/domain";
import { webActor } from "@/lib/auth/server";
import { failure, privateJson } from "@/lib/http";
export async function GET() {
  try {
    return privateJson(await getTotakeSummary(await webActor()));
  } catch (e) {
    return failure(e);
  }
}
