import { getTask } from "@wuff/domain";
import { listResponse } from "@/lib/list-response";
import { failure } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return await listResponse((actor) => getTask(actor, id));
  } catch (error) {
    return failure(error);
  }
}
