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
    transport: z.literal("web"),
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
  });
export const removeReminderDeviceSchema = z.object({
  operationId: uuid,
  deviceId: uuid,
});
// Retired transport values are read-only legacy records, retained for explicit removal.
// New registrations use reminderDeviceSchema and accept Web Push only.
export type ReminderDevice = {
  id: string;
  label: string;
  transport: "web" | "ios" | "macos" | "android" | "windows";
};
