import {
  boolean,
  check,
  date,
  foreignKey,
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
import type {
  ListColor,
  TodoList,
  Task,
  TaskReference,
  ListView,
} from "@wuff/contracts";
import { sql } from "drizzle-orm";
import { users, reminderDevices } from "../../platform/schema";
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
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
  mode: text("mode").$type<TodoList["mode"]>().notNull().default("simple"),
  createdAt: time("created_at"),
});
export const listPreferences = pgTable("wuff_list_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  listIds: jsonb("list_ids").$type<string[]>().notNull().default([]),
  nesting: jsonb("nesting")
    .$type<import("@wuff/contracts").ListNesting[]>()
    .notNull()
    .default([]),
  favoriteListIds: jsonb("favorite_list_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  collapsedListIds: jsonb("collapsed_list_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
});
export const dashboardPreferences = pgTable("wuff_dashboard_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  settings: jsonb("settings")
    .$type<import("@wuff/contracts").DashboardSettings>()
    .notNull(),
});
export const listViews = pgTable(
  "wuff_list_views",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(0),
    view: jsonb("view").$type<ListView>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listId] })],
);
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
export const tasks = pgTable(
  "wuff_tasks",
  {
    parentTaskId: uuid("parent_task_id"),
    number: integer("number").generatedAlwaysAsIdentity(),
    status: text("status").$type<Task["status"]>().notNull().default("todo"),
    priority: text("priority")
      .$type<Task["priority"]>()
      .notNull()
      .default("none"),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    references: jsonb("references")
      .$type<TaskReference[]>()
      .notNull()
      .default([]),
    updatedAt: time("updated_at"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    dueDate: date("due_date", { mode: "string" }),
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
  },
  (t) => [
    uniqueIndex("wuff_tasks_number_idx").on(t.number),
    check(
      "wuff_tasks_status",
      sql`${t.status} in ('todo', 'in_progress', 'in_review', 'blocked', 'done')`,
    ),
    check(
      "wuff_tasks_completion_status",
      sql`${t.completed} = (${t.status} = 'done')`,
    ),
    check(
      "wuff_tasks_priority",
      sql`${t.priority} in ('none', 'low', 'medium', 'high', 'urgent')`,
    ),
    check(
      "wuff_tasks_due_date_range",
      sql`${t.dueDate} is null or ${t.dueDate} between date '0001-01-01' and date '9999-12-31'`,
    ),
    uniqueIndex("wuff_tasks_id_list_idx").on(t.id, t.listId),
    index("wuff_tasks_parent_idx").on(t.parentTaskId),
    foreignKey({
      columns: [t.parentTaskId, t.listId],
      foreignColumns: [t.id, t.listId],
      name: "wuff_tasks_parent_fk",
    }).onDelete("cascade"),
    check(
      "wuff_tasks_not_self_parent",
      sql`${t.parentTaskId} is null or ${t.parentTaskId} <> ${t.id}`,
    ),
    check(
      "wuff_tasks_child_no_section",
      sql`${t.parentTaskId} is null or ${t.sectionId} is null`,
    ),
  ],
);
export const attachments = pgTable(
  "wuff_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id").references(() => lists.id, {
      onDelete: "set null",
    }),
    taskId: uuid("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id),
    digest: text("digest").notNull(),
    pathname: text("pathname").notNull().unique(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    ready: boolean("ready").notNull().default(false),
    attached: boolean("attached").notNull().default(false),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: time("created_at"),
  },
  (t) => [
    index("wuff_attachments_task_idx").on(t.taskId),
    index("wuff_attachments_cleanup_idx").on(t.createdAt),
  ],
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
export const githubAccounts = pgTable("wuff_github_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  githubId: text("github_id").notNull(),
  login: text("login").notNull(),
  credentials: text("credentials").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const githubAuthStates = pgTable("wuff_github_auth_states", {
  hash: text("hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  verifier: text("verifier").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const githubBindings = pgTable("wuff_github_bindings", {
  listId: uuid("list_id")
    .primaryKey()
    .references(() => lists.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  installationId: text("installation_id").notNull(),
  repositoryId: text("repository_id").notNull(),
  repository: text("repository").notNull(),
  autoCreateIssues: boolean("auto_create_issues").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: time("created_at"),
});
export const githubLinks = pgTable(
  "wuff_github_links",
  {
    taskId: uuid("task_id")
      .primaryKey()
      .references(() => tasks.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull(),
    issueNumber: integer("issue_number"),
    nodeId: text("node_id"),
    baseline:
      jsonb("baseline").$type<import("@wuff/contracts").GithubSyncFields>(),
    conflict: jsonb("conflict").$type<{
      wuff: import("@wuff/contracts").GithubSyncFields;
      github: import("@wuff/contracts").GithubSyncFields;
    }>(),
    state: text("state").notNull().default("pending"),
    revision: integer("revision").notNull().default(0),
    error: text("error"),
    operationId: uuid("operation_id").notNull(),
  },
  (t) => [
    uniqueIndex("wuff_github_issue_unique").on(t.repositoryId, t.issueNumber),
  ],
);
export const githubJobs = pgTable("wuff_github_jobs", {
  id: text("id").primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  generation: integer("generation").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  availableAt: time("available_at"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  createdAt: time("created_at"),
});
export const githubDeliveries = pgTable("wuff_github_deliveries", {
  id: text("id").primaryKey(),
  digest: text("digest").notNull(),
  createdAt: time("created_at"),
});
export const githubPrSnapshots = pgTable("wuff_github_pr_snapshots", {
  taskId: uuid("task_id")
    .primaryKey()
    .references(() => tasks.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id").notNull(),
  issueNumber: integer("issue_number").notNull(),
  pullRequests: jsonb("pull_requests")
    .$type<import("@wuff/contracts").GithubPullRequest[]>()
    .notNull()
    .default([]),
  stale: boolean("stale").notNull().default(true),
  fetchedAt: time("fetched_at"),
});
export const agentAccounts = pgTable("wuff_agent_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  credentials: text("credentials").notNull(),
  createdAt: time("created_at"),
});
export const agentBindings = pgTable("wuff_agent_bindings", {
  listId: uuid("list_id")
    .primaryKey()
    .references(() => lists.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  environmentId: uuid("environment_id").notNull(),
  environmentName: text("environment_name").notNull(),
  repository: text("repository").notNull(),
  requiredSecrets: jsonb("required_secrets")
    .$type<string[]>()
    .notNull()
    .default([]),
});
export const agentConversations = pgTable("wuff_agent_conversations", {
  taskId: uuid("task_id")
    .primaryKey()
    .references(() => tasks.id, { onDelete: "cascade" }),
  listId: uuid("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  agentId: text("agent_id").notNull().unique(),
  environmentId: uuid("environment_id").notNull(),
  environmentName: text("environment_name").notNull(),
  repository: text("repository").notNull(),
  createdAt: time("created_at"),
});
export const agentRuns = pgTable(
  "wuff_agent_runs",
  {
    id: uuid("id").primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    operationId: uuid("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    providerRunId: text("provider_run_id"),
    initial: boolean("initial").notNull(),
    mode: text("mode").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").notNull().default("queued"),
    result: text("result"),
    pullRequestUrls: jsonb("pull_request_urls")
      .$type<string[]>()
      .notNull()
      .default([]),
    error: text("error"),
    lastEventId: text("last_event_id"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: time("created_at"),
  },
  (t) => [uniqueIndex("wuff_agent_operation").on(t.actorId, t.operationId)],
);
export const reminderPreferences = pgTable("wuff_reminder_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  preferences: jsonb("preferences")
    .$type<import("@wuff/contracts").ReminderPreferences>()
    .notNull(),
});
export const reminderLists = pgTable(
  "wuff_reminder_lists",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(0),
    dailyIncluded: boolean("daily_included").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listId] })],
);
export const reminderJobs = pgTable(
  "wuff_reminder_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"task" | "digest">().notNull(),
    version: integer("version").notNull().default(1),
    runAt: time("run_at"),
    enabled: boolean("enabled").notNull().default(true),
    scheduling: text("scheduling").notNull().default("pending"),
    messageId: text("message_id"),
  },
  (t) => [
    uniqueIndex("wuff_reminder_task_user").on(t.userId, t.taskId),
    uniqueIndex("wuff_reminder_digest_user")
      .on(t.userId)
      .where(sql`${t.kind} = 'digest'`),
    index("wuff_reminder_pending").on(t.scheduling),
  ],
);
export const reminderDeliveries = pgTable(
  "wuff_reminder_deliveries",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => reminderJobs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => reminderDevices.id, { onDelete: "cascade" }),
    sentAt: time("sent_at"),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.version, t.deviceId] })],
);
