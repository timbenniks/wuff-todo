import { z } from "zod";
import type { State } from "./engine/model";
export * as totakeEngine from "./engine/index";
export type {
  State as TotakeState,
  Occurrence as TotakeOccurrence,
} from "./engine/model";
export type { Treatment, SetupDraft } from "./engine/treatments";
const boundedText = z.string().min(1).max(240);
const quantity = z
  .string()
  .regex(/^-?\d+(?:\.\d{1,12})?$/)
  .refine((v) => Math.abs(Number(v)) <= 1e9, "Quantity is too large");
const repeat = z
  .number()
  .int()
  .refine(
    (v) => [5, 10, 15, 20, 30].includes(v),
    "Choose a supported repeat interval",
  );
const day = z.number().int().min(0).max(84000);
export const totakeTreatmentSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(180),
    kind: z.enum(["medication", "equipment"]),
    equipmentType: z.enum(["sensor", "catheter", "custom"]),
    form: z.string().trim().min(1).max(60),
    unit: z.string().trim().min(1).max(60),
    detail: z.string().max(80),
    schedule: z.enum([
      "daily",
      "twice",
      "prn",
      "interval",
      "multiple",
      "weekdays",
      "cycle",
    ]),
    intervalEvery: z.number().int().min(1).max(365),
    intervalUnit: z.enum(["hours", "days"]),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    onDays: z.number().int().min(1).max(365),
    offDays: z.number().int().min(1).max(365),
    proposalAccepted: z.boolean(),
    startDay: day,
    slots: z
      .array(
        z.object({
          id: z.uuid(),
          time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          quantity,
        }),
      )
      .min(1)
      .max(24),
    repeat,
    inventory: z.object({
      enabled: z.boolean(),
      current: quantity,
      threshold: quantity,
      unit: z.string().min(1).max(60),
    }),
    revision: z.number().int().nonnegative(),
    groupIntervals: z
      .record(z.string().regex(/^\d{1,4}$/), repeat)
      .refine((v) => Object.keys(v).length <= 1440),
    groupEdits: z
      .record(z.string().regex(/^\d{1,4}$/), z.boolean())
      .refine((v) => Object.keys(v).length <= 1440),
    startDateText: z.string().max(10).optional(),
  })
  .strict();
const intake = z
  .object({
    id: z.uuid(),
    medicationId: z.union([z.uuid(), z.literal("")]),
    medication: totakeTreatmentSchema,
    quantity,
    strength: z.string().max(80),
    note: z.string().max(500),
    day: z.iso.date(),
    dateText: z.string().max(10).optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    fold: z.enum(["first", "second"]),
    initialWall: z.number().int(),
    initialInstant: z.number().finite().optional(),
  })
  .strict();
const group = z.object({
  groupId: boundedText,
  itemIds: z
    .array(boundedText)
    .min(1)
    .max(100)
    .refine((v) => new Set(v).size === v.length, "Select each item once"),
});
export const totakeActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save_treatment"),
      draft: totakeTreatmentSchema,
    })
    .strict(),
  group
    .extend({
      action: z.literal("record"),
      outcome: z.enum(["taken", "skipped"]),
    })
    .strict(),
  group
    .extend({
      action: z.literal("snooze"),
      minutes: z.union([
        z.literal(15),
        z.literal(30),
        z.literal(45),
        z.literal(60),
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal("undo"),
      groupId: boundedText,
      recordId: boundedText,
    })
    .strict(),
  z.object({ action: z.literal("record_intake"), draft: intake }).strict(),
  z.object({ action: z.literal("undo_intake"), intakeId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("adjust_stock"),
      treatmentId: z.uuid(),
      kind: z.enum(["add", "correct"]),
      quantity,
    })
    .strict(),
  z
    .object({
      action: z.literal("move_reminder"),
      groupId: boundedText,
      itemId: boundedText,
      toDue: z.number().int().min(0).max(120960000),
      scope: z.enum(["one", "future"]),
      acceptProposal: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("settings"),
      repeat,
      timezone: z
        .string()
        .max(100)
        .refine((v) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: v });
            return true;
          } catch {
            return false;
          }
        }, "Choose a valid timezone"),
    })
    .strict(),
]);
export const totakeNotificationContextSchema = z
  .object({
    userId: z.uuid(),
    deviceId: z.uuid(),
    groupId: boundedText,
    itemId: boundedText,
    identity: z.string().min(1).max(4096),
    lastAuditId: boundedText.nullable(),
    issuedAt: z.number().int().nonnegative().safe(),
    expiresAt: z.number().int().nonnegative().safe(),
  })
  .strict()
  .refine(
    (v) => v.expiresAt > v.issuedAt && v.expiresAt - v.issuedAt <= 3600000,
    "Invalid notification lifetime",
  );
export type TotakeNotificationContext = z.infer<
  typeof totakeNotificationContextSchema
>;
export const totakeMutationSchema = z
  .object({
    operationId: z.uuid(),
    version: z.number().int().nonnegative(),
    change: totakeActionSchema,
    notification: totakeNotificationContextSchema.optional(),
  })
  .strict();
export type TotakeAction = z.infer<typeof totakeActionSchema>;
export type TotakeMutation = z.infer<typeof totakeMutationSchema>;
export type TotakeSnapshot = {
  userId: string;
  version: number;
  state: State;
  delivery: { enabled: boolean; message: string };
};
export const totakeQuerySchema = z
  .object({ day: z.number().int().min(0).max(84000).optional() })
  .strict();
export type TotakeSummary = {
  userId: string;
  timezone: string;
  today: number;
  overdue: number;
  recordedToday: number;
  lowStock: number;
  next: { id: string; at: number; count: number }[];
};
