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
export const webPushSubscriptionSchema = z
  .object({
    endpoint: z.url().max(2048),
    keys: z.object({
      p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=$|^[A-Za-z0-9_-]{87}$/),
      auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
    }),
  })
  .strict();
export const reminderDeviceSchema = z
  .object({
    operationId: uuid,
    label: z.string().trim().min(1).max(80),
    transport: z.enum(["web", "ios", "macos", "android", "windows"]),
    address: z.string().max(4096),
    subscription: webPushSubscriptionSchema.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.transport === "web" &&
      (!v.subscription || v.address !== v.subscription.endpoint)
    )
      ctx.addIssue({
        code: "custom",
        message: "A browser subscription is required",
      });
    if (
      ["ios", "macos"].includes(v.transport) &&
      !/^[a-f0-9]{64,200}$/i.test(v.address)
    )
      ctx.addIssue({ code: "custom", message: "Invalid Apple device token" });
    if (
      v.transport === "android" &&
      !/^[A-Za-z0-9_:\-]{20,4096}$/.test(v.address)
    )
      ctx.addIssue({ code: "custom", message: "Invalid Android device token" });
  });
export const removeReminderDeviceSchema = z.object({
  operationId: uuid,
  deviceId: uuid,
});
export type ReminderDevice = {
  id: string;
  label: string;
  transport: "web" | "ios" | "macos" | "android" | "windows";
};
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
