import { z } from "zod";
export const notificationSettingsSchema = z
  .object({
    operationId: z.uuid(),
    version: z.number().int().nonnegative(),
    paused: z.boolean(),
    apps: z.object({ todo: z.boolean(), totake: z.boolean() }),
    showContent: z.boolean(),
  })
  .strict();
export type NotificationSettings = {
  userId: string;
  version: number;
  paused: boolean;
  apps: { todo: boolean; totake: boolean };
  showContent: boolean;
};

export type NotificationSettingsUpdate = z.infer<
  typeof notificationSettingsSchema
>;
