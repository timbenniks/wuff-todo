import { ClientError, type NativeClient } from "@wuff/client";
import { ApiError } from "@wuff/ui/features/api";
import type { FeatureApi } from "@wuff/ui/features/runtime";
// Explicit route mapping keeps shared UI independent of cookie authentication.
// Reject unknown routes instead of ever fetching an arbitrary supplied URL.
export function featureApi(
  client: Pick<NativeClient, "call">,
  userId?: string,
): FeatureApi {
  return async <T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    const url = new URL(path, "https://wuff.invalid");
    if (url.origin !== "https://wuff.invalid")
      throw new ApiError("Unsupported app operation.", 400);
    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const data = (body ?? {}) as Record<string, unknown>;
    let action: string | undefined,
      input: unknown = data;
    if (parts[0] !== "api" || parts[1] !== "v1")
      throw new ApiError("Unsupported app operation.", 400);
    const [, , kind, id, sub, subId] = parts;
    if (kind === "reminders" && !id) {
      if (method === "GET") {
        action = url.searchParams.has("taskId")
          ? "getTaskReminder"
          : url.searchParams.has("listId")
            ? "getListReminders"
            : "getReminderSettings";
        input =
          action === "getTaskReminder"
            ? {
                listId: url.searchParams.get("listId"),
                taskId: url.searchParams.get("taskId"),
              }
            : action === "getListReminders"
              ? { listId: url.searchParams.get("listId") }
              : undefined;
      } else if (method === "POST") {
        action = (
          {
            settings: "updateReminderSettings",
            list: "updateListReminders",
            task: "setTaskReminder",
            localTime: "resolveReminderLocalTime",
            device: "registerReminderDevice",
            removeDevice: "removeReminderDevice",
          } as Record<string, string>
        )[String(data.action)];
        input = data.input;
      }
    } else if (kind === "lists" && !id)
      action =
        method === "GET"
          ? "listLists"
          : method === "POST"
            ? "createList"
            : undefined;
    else if (kind === "lists" && id) {
      input = { ...data, listId: id };
      if (!sub) {
        action = (
          {
            GET: "getList",
            PATCH: "updateList",
            DELETE: "deleteList",
          } as Record<string, string>
        )[method];
        if (method === "GET") input = id;
      } else if (sub === "sharing" && method === "GET") {
        action = "getListSharing";
        input = id;
      } else if (sub === "sections")
        action = (
          {
            POST: "createSection",
            PATCH: "renameSection",
            DELETE: "deleteSection",
            PUT: "reorderSections",
          } as Record<string, string>
        )[method];
      else if (sub === "view") {
        action =
          method === "PUT"
            ? "updateListView"
            : method === "GET"
              ? "queryListView"
              : undefined;
        if (method === "GET")
          input = { listId: id, today: url.searchParams.get("today") };
      } else if (sub === "invitations") {
        action =
          subId && method === "DELETE"
            ? "cancelInvitation"
            : !subId && method === "POST"
              ? "inviteToList"
              : undefined;
        if (subId) input = { ...data, listId: id, invitationId: subId };
      } else if (sub === "members" && subId && method === "DELETE") {
        action = "removeListMember";
        input = { ...data, listId: id, userId: subId };
      } else if (sub === "leave" && method === "POST") action = "leaveList";
    } else if (kind === "tasks" && !id)
      action = (
        {
          POST: "createTask",
          PATCH: "updateTask",
          DELETE: "deleteTask",
          PUT: "reorderTasks",
        } as Record<string, string>
      )[method];
    else if (kind === "invitations") {
      action =
        !id && method === "GET"
          ? "listInvitations"
          : id && method === "POST"
            ? "respondToInvitation"
            : undefined;
      if (id) input = { ...data, invitationId: id };
    } else if (kind === "list-order")
      action =
        method === "GET"
          ? "getListOrder"
          : method === "PUT"
            ? "reorderLists"
            : undefined;
    else if (kind === "dashboard") {
      action =
        method === "GET"
          ? "getDashboard"
          : method === "PUT"
            ? "updateDashboard"
            : undefined;
      if (method === "GET")
        input = {
          today: url.searchParams.get("today"),
          ...(url.searchParams.has("limit")
            ? { limit: Number(url.searchParams.get("limit")) }
            : {}),
        };
    } else if (kind === "live" && method === "POST") action = "getLive";
    else if (kind === "github" && method === "GET") {
      action = url.searchParams.has("pullRequests")
        ? "githubPullRequests"
        : url.searchParams.has("taskId")
          ? "githubTask"
          : undefined;
      input =
        url.searchParams.get("pullRequests") ?? url.searchParams.get("taskId");
    } else if (kind === "github" && method === "POST") {
      const { action: kind, ...rest } = data;
      action = (
        {
          link: "githubLink",
          unlink: "githubUnlink",
          retry: "githubRetry",
          resolve: "githubResolve",
        } as Record<string, string>
      )[String(kind)];
      input = rest;
    } else if (kind === "agents" && method === "GET") {
      action = url.searchParams.has("activity") ? "agentActivity" : "agentTask";
      input =
        action === "agentTask"
          ? url.searchParams.get("taskId")
          : {
              taskId: url.searchParams.get("taskId"),
              runId: url.searchParams.get("activity"),
              cursor: url.searchParams.get("cursor") ?? undefined,
            };
    }
    if (!action)
      throw new ApiError(
        "Open the website to manage this connection.",
        400,
        "unsupported_native_action",
      );
    try {
      return await client.call<T>(action, input, userId);
    } catch (error) {
      if (error instanceof ClientError && error.status)
        throw new ApiError(error.message, error.status, error.code);
      throw error;
    }
  };
}
