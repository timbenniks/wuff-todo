import {
  boolean,
  integer,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../../platform/schema";
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const totakeAccounts = pgTable("wuff_totake_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  metadata: jsonb("metadata")
    .$type<
      Omit<
        import("@wuff/contracts").TotakeState,
        "treatments" | "groups" | "audit" | "intakes"
      >
    >()
    .notNull(),
});
export const totakeTreatments = pgTable(
  "wuff_totake_treatments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    body: jsonb("body").$type<import("@wuff/contracts").Treatment>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);
export const totakeSchedules = pgTable(
  "wuff_totake_schedules",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    treatmentId: text("treatment_id").notNull(),
    revision: integer("revision").notNull(),
    body: jsonb("body").$type<import("@wuff/contracts").Treatment>().notNull(),
    createdAt: time("created_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.treatmentId, t.revision] })],
);
export const totakeOccurrences = pgTable(
  "wuff_totake_occurrences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    day: integer("day").notNull(),
    body: jsonb("body")
      .$type<import("@wuff/contracts").TotakeOccurrence>()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("wuff_totake_occurrence_day").on(t.userId, t.day),
  ],
);
export const totakeRecords = pgTable(
  "wuff_totake_records",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    groupId: text("group_id").notNull(),
    kind: text("kind").$type<"scheduled" | "intake">().notNull(),
    undone: boolean("undone").notNull().default(false),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);
export const totakeAudit = pgTable(
  "wuff_totake_audit",
  {
    ordinal: integer("ordinal").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);
export const totakeStockMovements = pgTable(
  "wuff_totake_stock_movements",
  {
    ordinal: integer("ordinal").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);
export const totakeJobs = pgTable("wuff_totake_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  runAt: timestamp("run_at", { withTimezone: true }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  scheduling: text("scheduling").notNull().default("pending"),
});
export const totakeDeliveries = pgTable(
  "wuff_totake_deliveries",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => totakeJobs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    deviceId: uuid("device_id").notNull(),
    groupId: text("group_id").notNull(),
    sentAt: time("sent_at"),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.version, t.deviceId, t.groupId] })],
);
