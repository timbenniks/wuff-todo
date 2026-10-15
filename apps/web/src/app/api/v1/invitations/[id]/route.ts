import { failure, jsonInput, sameOrigin } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { respondToInvitation } from "@wuff/domain";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    const params = await context.params;
    return await listResponse((actor) =>
      respondToInvitation(actor, { ...data, invitationId: params.id }),
    );
  } catch (error) {
    return failure(error);
  }
}
