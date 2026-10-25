import { failure } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { getListSharing } from "@wuff/domain";
import { idSchema } from "@wuff/contracts";
export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = idSchema.parse((await context.params).id);
    return await listResponse((actor) => getListSharing(actor, id));
  } catch (error) {
    return failure(error);
  }
}
