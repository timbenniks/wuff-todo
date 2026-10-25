import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { webActor } from "@/lib/auth/server";
import { getListOrder, reorderLists } from "@wuff/domain";
export async function GET() {
  try {
    return privateJson(await getListOrder(await webActor()));
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await reorderLists(await webActor(), await jsonInput(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
