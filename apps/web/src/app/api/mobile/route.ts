import { after } from "next/server";
import { AppError, idSchema, taskLookupSchema } from "@wuff/contracts";
import {
  listLists,
  getList,
  createList,
  updateList,
  deleteList,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  createSection,
  renameSection,
  deleteSection,
  reorderSections,
  getListSharing,
  listInvitations,
  inviteToList,
  respondToInvitation,
  cancelInvitation,
  removeListMember,
  leaveList,
  getListOrder,
  reorderLists,
  queryListView,
  updateListView,
  getTask,
  processGithubJobs,
  requireScope,
} from "@wuff/domain";
import { bearerActor } from "@/lib/oauth";
import { nativeResource } from "@/lib/config";
import { failure, jsonInput, privateJson } from "@/lib/http";
import { z } from "zod";
import { sealLiveLists } from "@/lib/live-server";

// A bearer-only native adapter: cookies and Origin headers never grant access.
// All permissions, versions, receipts and validation stay in domain services.
const operations = {
  listLists,
  createList,
  updateList,
  deleteList,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  createSection,
  renameSection,
  deleteSection,
  reorderSections,
  inviteToList,
  respondToInvitation,
  cancelInvitation,
  removeListMember,
  leaveList,
  reorderLists,
  queryListView,
  updateListView,
} as const;
const envelope = z
  .object({ action: z.string(), input: z.unknown().optional() })
  .strict();

export async function POST(request: Request) {
  try {
    let actor;
    try {
      actor = await bearerActor(request, nativeResource());
    } catch {
      throw new AppError("unauthorized", "Please sign in again.", 401);
    }
    const { action, input } = envelope.parse(await jsonInput(request, 131_072));
    let result: unknown;
    if (action === "session")
      result = { userId: actor.id, scopes: actor.scopes };
    else if (action === "getLive") {
      requireScope(actor, "lists:read");
      const expected = z
        .object({ userId: z.string().min(1).max(200) })
        .strict()
        .parse(input);
      if (expected.userId !== actor.id)
        throw new AppError(
          "account_changed",
          "Your signed-in account changed. Sign in again.",
          409,
        );
      result = await sealLiveLists(actor);
      if (!result)
        throw new AppError(
          "live_unavailable",
          "Live updates are unavailable. Regular refresh is still active.",
          503,
        );
    } else if (action === "getList")
      result = await getList(actor, idSchema.parse(input));
    else if (action === "getTask")
      result = await getTask(actor, taskLookupSchema.parse(input));
    else if (action === "getListSharing")
      result = await getListSharing(actor, idSchema.parse(input));
    else if (action === "listInvitations")
      result = await listInvitations(actor);
    else if (action === "getListOrder") result = await getListOrder(actor);
    else if (Object.hasOwn(operations, action))
      result = await operations[action as keyof typeof operations](
        actor,
        input,
      );
    else throw new AppError("not_found", "Unknown mobile operation.", 404);
    if (["createTask", "updateTask", "deleteTask"].includes(action))
      after(() => processGithubJobs());
    return privateJson(result);
  } catch (error) {
    const response = failure(error);
    response.headers.set("Cache-Control", "no-store");
    if (response.status === 401)
      response.headers.set("WWW-Authenticate", "Bearer");
    return response;
  }
}
