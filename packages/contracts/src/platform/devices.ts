import { z } from "zod";
const uuid = z.uuid();
export const webPushSubscriptionSchema = z
  .object({
    endpoint: z.url().max(2048),
    // Standard PushSubscription.toJSON includes this even when it is null.
    expirationTime: z.number().finite().nonnegative().nullable().optional(),
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
