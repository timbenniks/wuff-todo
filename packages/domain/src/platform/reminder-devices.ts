import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { reminderDevices } from "@wuff/db";
import {
  reminderDeviceSchema,
  removeReminderDeviceSchema,
  type Actor,
} from "@wuff/contracts";
import { allowedPushEndpoint } from "./reminder-transport";
import { fail, notificationWrite } from "./notification-write";
export async function saveReminderDevice(actor: Actor, data: unknown) {
  const input = reminderDeviceSchema.parse(data);
  if (!allowedPushEndpoint(input.address, input.transport))
    fail(
      "invalid_endpoint",
      "This notification endpoint is not supported.",
      400,
    );
  await notificationWrite(actor, input, async (tx) => {
    const [existing] = await tx
      .select()
      .from(reminderDevices)
      .where(
        and(
          eq(reminderDevices.transport, input.transport),
          eq(reminderDevices.address, input.address),
        ),
      );
    if (existing && existing.userId !== actor.id)
      fail(
        "device_in_use",
        "Disable notifications in the previous account before connecting this device.",
        409,
      );
    const values = {
      label: input.label,
      subscription: input.subscription ?? null,
    };
    if (existing)
      await tx
        .update(reminderDevices)
        .set(values)
        .where(eq(reminderDevices.id, existing.id));
    else {
      const count = await tx
        .select({ id: reminderDevices.id })
        .from(reminderDevices)
        .where(eq(reminderDevices.userId, actor.id));
      if (count.length >= 20)
        fail(
          "device_limit",
          "Remove an old device before adding another.",
          400,
        );
      await tx.insert(reminderDevices).values({
        ...values,
        userId: actor.id,
        transport: input.transport,
        address: input.address,
      });
    }
  });
  // Preserve the existing device-registration scheduling behavior.
  const { moduleServices } = await import("./module-services");
  for (const module of moduleServices)
    await module.afterDeviceRegistration(actor.id);
}
export async function deleteReminderDevice(actor: Actor, data: unknown) {
  const input = removeReminderDeviceSchema.parse(data);
  await notificationWrite(actor, input, async (tx) => {
    await tx
      .delete(reminderDevices)
      .where(
        and(
          eq(reminderDevices.id, input.deviceId),
          eq(reminderDevices.userId, actor.id),
        ),
      );
  });
}
export async function disableBrowserReminders(actor: Actor, data: unknown) {
  const input = z
    .object({ operationId: z.uuid(), endpoint: z.string().max(2048) })
    .parse(data);
  await notificationWrite(actor, input, async (tx) => {
    await tx
      .delete(reminderDevices)
      .where(
        and(
          eq(reminderDevices.userId, actor.id),
          eq(reminderDevices.transport, "web"),
          eq(reminderDevices.address, input.endpoint),
        ),
      );
  });
  return { ok: true };
}
