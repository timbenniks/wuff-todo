import type { EmpireAppId, NotificationSettings } from "@wuff/contracts";
import type { Tx } from "./access";
import { empireModules } from "@wuff/contracts";
import { schedulePendingReminders } from "../modules/todo/reminders";
import { schedulePendingTotake } from "../modules/totake/delivery";
import { reconcileTodoNotificationPause } from "../modules/todo/notifications";
import { reconcileTotakeNotificationPause } from "../modules/totake/notifications";
const services = {
  notes: {
    schedulePending: async (_userId?: string) => {},
    afterDeviceRegistration: async (_userId: string) => {},
    reconcileNotificationPause: async () => {},
  },
  todo: {
    schedulePending: schedulePendingReminders,
    afterDeviceRegistration: async (_userId: string) => {},
    reconcileNotificationPause: reconcileTodoNotificationPause,
  },
  totake: {
    schedulePending: schedulePendingTotake,
    afterDeviceRegistration: schedulePendingTotake,
    reconcileNotificationPause: reconcileTotakeNotificationPause,
  },
} satisfies Record<
  EmpireAppId,
  {
    schedulePending: (userId?: string) => Promise<void>;
    afterDeviceRegistration: (userId: string) => Promise<void>;
    reconcileNotificationPause: (
      tx: Tx,
      userId: string,
      previous: NotificationSettings,
      next: Pick<NotificationSettings, "paused" | "apps">,
    ) => Promise<void>;
  }
>;
export const moduleServices = empireModules.map(
  (module) => services[module.id],
);
export async function scheduleModuleNotifications(userId?: string) {
  for (const module of moduleServices) await module.schedulePending(userId);
}
