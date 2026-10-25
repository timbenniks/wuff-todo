import * as domain from "@wuff/domain/modules/todo";
import {
  AppError,
  idSchema,
  taskLookupSchema,
  type Actor,
} from "@wuff/contracts";
import { z } from "zod";
import { sealLiveLists } from "@/lib/live-server";
import { requireScope } from "@wuff/domain";
export const todoNativeOperations = {
  getDashboard: domain.getDashboard,
  updateDashboard: domain.updateDashboard,
  resolveReminderLocalTime: domain.resolveReminderLocalTime,
  getListReminders: domain.getListReminders,
  getTaskReminder: domain.getTaskReminder,
  updateReminderSettings: domain.updateReminderSettings,
  updateListReminders: domain.updateListReminders,
  setTaskReminder: domain.setTaskReminder,
  registerReminderDevice: domain.registerReminderDevice,
  removeReminderDevice: domain.removeReminderDevice,
  listLists: domain.listLists,
  createList: domain.createList,
  updateList: domain.updateList,
  deleteList: domain.deleteList,
  createTask: domain.createTask,
  updateTask: domain.updateTask,
  deleteTask: domain.deleteTask,
  reorderTasks: domain.reorderTasks,
  createSection: domain.createSection,
  renameSection: domain.renameSection,
  deleteSection: domain.deleteSection,
  reorderSections: domain.reorderSections,
  inviteToList: domain.inviteToList,
  respondToInvitation: domain.respondToInvitation,
  cancelInvitation: domain.cancelInvitation,
  removeListMember: domain.removeListMember,
  leaveList: domain.leaveList,
  reorderLists: domain.reorderLists,
  queryListView: domain.queryListView,
  updateListView: domain.updateListView,
  githubLink: domain.githubLink,
  githubUnlink: domain.githubUnlink,
  githubRetry: domain.githubRetry,
  githubResolve: domain.githubResolve,
  getReminderSettings: (actor: Actor) => domain.getReminderSettings(actor),
  githubTask: (actor: Actor, input: unknown) =>
    domain.githubTask(actor, idSchema.parse(input)),
  githubPullRequests: (actor: Actor, input: unknown) =>
    domain.githubPullRequests(actor, idSchema.parse(input)),
  agentTask: (actor: Actor, input: unknown) =>
    domain.agentTask(actor, idSchema.parse(input)),
  agentActivity: async (actor: Actor, input: unknown) => {
    const value = z
      .object({
        taskId: idSchema,
        runId: idSchema,
        cursor: z
          .string()
          .max(2048)
          .refine((v) => !/[\r\n]/.test(v))
          .optional(),
      })
      .strict()
      .parse(input);
    return domain.agentActivity(actor, value.taskId, value.runId, value.cursor);
  },
  getLive: async (actor: Actor, input: unknown) => {
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
    const result = await sealLiveLists(actor);
    if (!result)
      throw new AppError(
        "live_unavailable",
        "Live updates are unavailable. Regular refresh is still active.",
        503,
      );
    return result;
  },
  getList: (actor: Actor, input: unknown) =>
    domain.getList(actor, idSchema.parse(input)),
  getTask: (actor: Actor, input: unknown) =>
    domain.getTask(actor, taskLookupSchema.parse(input)),
  getListSharing: (actor: Actor, input: unknown) =>
    domain.getListSharing(actor, idSchema.parse(input)),
  listInvitations: (actor: Actor) => domain.listInvitations(actor),
  getListOrder: (actor: Actor) => domain.getListOrder(actor),
};

export function afterTodoNativeAction(action: string) {
  return [
    "createTask",
    "updateTask",
    "deleteTask",
    "githubLink",
    "githubUnlink",
    "githubRetry",
    "githubResolve",
  ].includes(action)
    ? [domain.processGithubJobs]
    : [];
}
