import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { createList, listLists } from "@wuff/domain";
export async function GET() {
  try {
    return privateJson(await listLists(await webActor()));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return privateJson(
      await createList(await webActor(), await jsonInput(request)),
    );
  } catch (error) {
    return failure(error);
  }
}
