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
import type { ListColor } from "@wuff/contracts";

const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const users = pgTable("wuff_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: time("created_at"),
});
export const lists = pgTable("wuff_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  version: integer("version").notNull().default(0),
  color: text("color").$type<ListColor>().notNull().default("blue"),
  description: text("description").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdAt: time("created_at"),
});
export const listPreferences = pgTable("wuff_list_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  listIds: jsonb("list_ids").$type<string[]>().notNull().default([]),
});
export const sections = pgTable(
  "wuff_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("wuff_sections_list_idx").on(t.listId)],
);
export const members = pgTable(
  "wuff_members",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: time("created_at"),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] })],
);
export const tasks = pgTable("wuff_tasks", {
  content: text("content").notNull().default(""),
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  sectionId: uuid("section_id").references(() => sections.id, {
    onDelete: "set null",
  }),
  position: integer("position").notNull(),
  createdAt: time("created_at"),
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
export const invitations = pgTable(
  "wuff_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBy: text("accepted_by"),
    // Legacy token hashes are retained for compatibility, never used as authority.
    recipientId: text("recipient_id").references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: time("created_at"),
  },
  (t) => [
    index("wuff_invitations_recipient_idx").on(t.recipientId),
    index("wuff_invitations_list_idx").on(t.listId),
  ],
);
export const oauthClients = pgTable("wuff_oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: time("created_at"),
});
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
