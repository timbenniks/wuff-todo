import {
  boolean,
  integer,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("wuff_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: time("created_at"),
});
export const empirePreferences = pgTable("wuff_empire_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  apps: jsonb("apps")
    .$type<Record<string, { visible: boolean; dashboard: boolean }>>()
    .notNull()
    .default({}),
});
export const receipts = pgTable(
  "wuff_mutation_receipts",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    operationId: uuid("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    result: jsonb("result").notNull(),
    createdAt: time("created_at"),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.operationId] })],
);
export const oauthClients = pgTable("wuff_oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: time("created_at"),
});
export const mcpToolPreferences = pgTable(
  "wuff_mcp_tool_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(0),
    enabledTools: jsonb("enabled_tools")
      .$type<string[]>()
      .notNull()
      .default([]),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clientId] })],
);
export const oauthCodes = pgTable("wuff_oauth_codes", {
  hash: text("hash").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  redirectUri: text("redirect_uri").notNull(),
  scope: jsonb("scope").$type<string[]>().notNull(),
  challenge: text("challenge").notNull(),
  resource: text("resource").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const oauthTokens = pgTable(
  "wuff_oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accessHash: text("access_hash").notNull().unique(),
    refreshHash: text("refresh_hash").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    scope: jsonb("scope").$type<string[]>().notNull(),
    resource: text("resource").notNull(),
    issuer: text("issuer").notNull(),
    accessExpiresAt: timestamp("access_expires_at", {
      withTimezone: true,
    }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", {
      withTimezone: true,
    }).notNull(),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("wuff_tokens_refresh_idx").on(t.refreshHash)],
);
export const reminderDevices = pgTable(
  "wuff_reminder_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    transport: text("transport")
      .$type<import("@wuff/contracts").ReminderDevice["transport"]>()
      .notNull(),
    address: text("address").notNull(),
    subscription: jsonb("subscription").$type<{
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }>(),
    createdAt: time("created_at"),
  },
  (t) => [
    uniqueIndex("wuff_reminder_address").on(t.transport, t.address),
    index("wuff_reminder_device_user").on(t.userId),
  ],
);
export const notificationPreferences = pgTable(
  "wuff_notification_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(0),
    paused: boolean("paused").notNull().default(false),
    todo: boolean("todo").notNull().default(false),
    totake: boolean("totake").notNull().default(false),
    showContent: boolean("show_content").notNull().default(false),
  },
);
