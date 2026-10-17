import { failure, jsonInput, sameOrigin, privateJson } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { webActor } from "@/lib/auth/server";
import { queryListView, updateListView } from "@wuff/domain";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return privateJson(
      await queryListView(await webActor(), {
        listId: (await context.params).id,
        today: new URL(request.url).searchParams.get("today"),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request, 128 * 1024);
    const listId = (await context.params).id;
    return await listResponse((actor) =>
      updateListView(actor, { ...data, listId }),
    );
  } catch (error) {
    return failure(error);
  }
}
