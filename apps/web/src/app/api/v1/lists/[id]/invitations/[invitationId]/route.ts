import { failure, jsonInput, sameOrigin } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { cancelInvitation } from "@wuff/domain";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    const params = await context.params;
    return await listResponse((actor) =>
      cancelInvitation(actor, {
        ...data,
        listId: params.id,
        invitationId: params.invitationId,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
