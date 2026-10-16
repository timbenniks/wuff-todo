import { failure, jsonInput, privateJson, sameOrigin } from "@/lib/http";
import { webActor } from "@/lib/auth/server";
import {
  createSection,
  renameSection,
  deleteSection,
  reorderSections,
} from "@wuff/domain";
type Context = { params: Promise<{ id: string }> };
async function change(
  request: Request,
  context: Context,
  action: typeof createSection,
) {
  try {
    sameOrigin(request);
    const data = await jsonInput(request);
    return privateJson(
      await action(await webActor(), {
        ...data,
        listId: (await context.params).id,
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export const POST = (r: Request, c: Context) => change(r, c, createSection);
export const PATCH = (r: Request, c: Context) => change(r, c, renameSection);
export const DELETE = (r: Request, c: Context) => change(r, c, deleteSection);
export const PUT = (r: Request, c: Context) => change(r, c, reorderSections);
