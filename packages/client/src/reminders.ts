import type { NativeClient } from "./index";
import type {
  ReminderSettings,
  ReminderPreferences,
  PersonalReminder,
  ReminderDevice,
} from "@wuff/contracts";
// Installed platform plugins supply token/channel values. This wrapper never
// substitutes browser PushManager for a native registration and stores no tokens.
export class NativeReminders {
  constructor(private client: NativeClient) {}
  settings() {
    return this.client.call<ReminderSettings>("getReminderSettings");
  }
  saveSettings(
    version: number,
    preferences: ReminderPreferences,
    operationId: string,
  ) {
    return this.client.call<ReminderSettings>("updateReminderSettings", {
      version,
      preferences,
      operationId,
    });
  }
  list(listId: string) {
    return this.client.call<{
      version: number;
      dailyIncluded: boolean;
      reminders: PersonalReminder[];
    }>("getListReminders", { listId });
  }
  saveList(
    listId: string,
    version: number,
    dailyIncluded: boolean,
    operationId: string,
  ) {
    return this.client.call("updateListReminders", {
      listId,
      version,
      dailyIncluded,
      operationId,
    });
  }
  task(listId: string, taskId: string) {
    return this.client.call<{ reminder: PersonalReminder | null }>(
      "getTaskReminder",
      { listId, taskId },
    );
  }
  setTask(
    listId: string,
    taskId: string,
    version: number,
    runAt: string | null,
    operationId: string,
  ) {
    return this.client.call<{ reminder: PersonalReminder }>("setTaskReminder", {
      listId,
      taskId,
      version,
      runAt,
      operationId,
    });
  }
  register(
    transport: Exclude<ReminderDevice["transport"], "web">,
    address: string,
    label: string,
    operationId: string,
  ) {
    return this.client.call<ReminderSettings>("registerReminderDevice", {
      transport,
      address,
      label,
      operationId,
    });
  }
  remove(deviceId: string, operationId: string) {
    return this.client.call<ReminderSettings>("removeReminderDevice", {
      deviceId,
      operationId,
    });
  }
}
