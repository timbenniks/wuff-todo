import { failure, jsonInput, sameOrigin } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { leaveList } from "@wuff/domain";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    const params = await context.params;
    return await listResponse((actor) =>
      leaveList(actor, { ...data, listId: params.id }),
    );
  } catch (error) {
    return failure(error);
  }
}
