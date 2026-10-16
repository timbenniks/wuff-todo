import { failure, jsonInput, sameOrigin } from "@/lib/http";
import { listResponse } from "@/lib/list-response";
import { deleteList, getList, updateList } from "@wuff/domain";
import { idSchema } from "@wuff/contracts";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  try {
    const id = idSchema.parse((await context.params).id);
    return await listResponse((actor) => getList(actor, id));
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    const listId = (await context.params).id;
    return await listResponse((actor) =>
      updateList(actor, {
        ...data,
        listId,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    const listId = (await context.params).id;
    return await listResponse((actor) =>
      deleteList(actor, {
        ...data,
        listId,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
