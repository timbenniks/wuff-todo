import { webActor } from "@/lib/auth/server";
import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { deleteList, getList, renameList } from "@wuff/domain";
import { idSchema } from "@wuff/contracts";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  try {
    return privateJson(
      await getList(
        await webActor(),
        idSchema.parse((await context.params).id),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    return privateJson(
      await renameList(await webActor(), {
        ...data,
        listId: (await context.params).id,
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
    return privateJson(
      await deleteList(await webActor(), {
        ...data,
        listId: (await context.params).id,
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
