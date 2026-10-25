import type { ReminderDevice } from "../../platform/devices";
import { z } from "zod";
const uuid = z.uuid();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const reminderTimezoneSchema = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return !/^[+-]/.test(v);
    } catch {
      return false;
    }
  }, "Choose a valid timezone");
export const reminderPreferencesSchema = z
  .object({
    timezone: reminderTimezoneSchema.default("Europe/Paris"),
    dailyEnabled: z.boolean().default(false),
    dailyTime: clock.default("09:00"),
    quietEnabled: z.boolean().default(true),
    quietStart: clock.default("21:00"),
    quietEnd: clock.default("08:00"),
    showTaskTitles: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => !v.quietEnabled || v.quietStart !== v.quietEnd,
    "Quiet hours must have different start and end times",
  );
export type ReminderPreferences = z.infer<typeof reminderPreferencesSchema>;
export const updateReminderPreferencesSchema = z.object({
  operationId: uuid,
  version: z.number().int().nonnegative(),
  preferences: reminderPreferencesSchema,
});
export const listReminderSchema = z.object({ listId: uuid });
export const updateListReminderSchema = listReminderSchema.extend({
  operationId: uuid,
  version: z.number().int().nonnegative(),
  dailyIncluded: z.boolean(),
});
export const taskReminderQuerySchema = z.object({ listId: uuid, taskId: uuid });
export const setTaskReminderSchema = taskReminderQuerySchema.extend({
  operationId: uuid,
  version: z.number().int().nonnegative(),
  runAt: z.iso.datetime({ offset: true }).nullable(),
});
export type PersonalReminder = {
  id: string;
  taskId: string | null;
  version: number;
  runAt: string;
  enabled: boolean;
  scheduling: string;
};
export type ReminderSettings = {
  version: number;
  preferences: ReminderPreferences;
  devices: ReminderDevice[];
  delivery: Record<ReminderDevice["transport"], boolean>;
  publicKey: string | null;
  schedulerReady: boolean;
};
