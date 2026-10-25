import { failure, jsonInput, sameOrigin } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { removeListMember } from "@wuff/domain";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    const params = await context.params;
    return await listResponse((actor) =>
      removeListMember(actor, {
        ...data,
        listId: params.id,
        userId: params.userId,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
