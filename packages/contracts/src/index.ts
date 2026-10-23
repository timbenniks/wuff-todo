import { z } from "zod";

export const titleSchema = z.string().trim().min(1).max(300);
// Canonical task notes are Markdown, shared by web and MCP. No HTML is executed.
export const taskContentLimit = 16_000;
export const taskContentSchema = z.string().max(taskContentLimit);
// Calendar dates, never instants. Reject year zero, which Postgres DATE lacks.
export const dueDateSchema = z.iso
  .date()
  .refine(
    (value) => value >= "0001-01-01",
    "Choose a calendar date from year 1 to 9999",
  );
export const idSchema = z.uuid();
export const operationSchema = z.object({ operationId: z.uuid() });
export const versionSchema = z.number().int().nonnegative();
export const listColors = [
  "blue",
  "lavender",
  "sage",
  "rose",
  "peach",
  "sand",
  "slate",
] as const;
export type ListColor = (typeof listColors)[number];
export const listColorSchema = z.enum(listColors);
export const listModes = ["simple", "work"] as const;
export const taskStatuses = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const;
export const taskPriorities = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export const taskStatusSchema = z.enum(taskStatuses);
export const taskPrioritySchema = z.enum(taskPriorities);
export const taskReferenceSchema = z.object({
  url: z
    .url()
    .max(2048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !/[\u0000-\u0020\u007f]/.test(value)
        );
      } catch {
        return false;
      }
    }, "Use an HTTP or HTTPS URL without credentials"),
  title: z.string().trim().max(200).optional(),
});
export const taskReferencesSchema = z.array(taskReferenceSchema).max(20);
export type TaskReference = z.infer<typeof taskReferenceSchema>;
export const taskLookupSchema = z
  .string()
  .regex(
    /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|WUFF-[1-9][0-9]{0,9})$/i,
  )
  .refine(
    (v) => !/^WUFF-/i.test(v) || Number(v.slice(5)) <= 2147483647,
    "Invalid task key",
  );
export const taskPath = (id: string) => `/tasks/${idSchema.parse(id)}`;
export const createListSchema = operationSchema.extend({
  title: titleSchema,
  mode: z.enum(listModes).optional(),
});
export const listMutationSchema = operationSchema.extend({
  listId: idSchema,
  version: versionSchema,
});
export const renameListSchema = listMutationSchema.extend({
  title: titleSchema,
});
export const updateListSchema = listMutationSchema
  .extend({
    title: titleSchema.optional(),
    description: z.string().trim().max(4000).optional(),
    color: listColorSchema.optional(),
    archived: z.boolean().optional(),
    mode: z.enum(listModes).optional(),
  })
  .refine(
    (v) =>
      [v.title, v.description, v.color, v.archived, v.mode].some(
        (x) => x !== undefined,
      ),
    "Provide a list change",
  );
export const reorderListsSchema = operationSchema.extend({
  version: versionSchema,
  listIds: z.array(idSchema).max(10000),
  nesting: z
    .array(z.object({ listId: idSchema, parentListId: idSchema }))
    .max(10000)
    .optional(),
  collapsedListIds: z.array(idSchema).max(10000).optional(),
  favoriteListIds: z.array(idSchema).max(10000).optional(),
});
export const createSectionSchema = listMutationSchema.extend({
  title: titleSchema,
});
export const sectionMutationSchema = listMutationSchema.extend({
  sectionId: idSchema,
});
export const renameSectionSchema = sectionMutationSchema.extend({
  title: titleSchema,
});
export const reorderSectionsSchema = listMutationSchema.extend({
  sectionIds: z.array(idSchema).max(50),
});
export const createTaskSchema = listMutationSchema.extend({
  title: titleSchema,
  dueDate: dueDateSchema.nullable().optional(),
  parentTaskId: idSchema.nullable().optional(),
  sectionId: idSchema.nullable().optional(),
  content: taskContentSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().min(1).max(200).nullable().optional(),
  references: taskReferencesSchema.optional(),
});
export const updateTaskSchema = listMutationSchema
  .extend({
    taskId: idSchema,
    dueDate: dueDateSchema.nullable().optional(),
    title: titleSchema.optional(),
    completed: z.boolean().optional(),
    sectionId: idSchema.nullable().optional(),
    content: taskContentSchema.optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().min(1).max(200).nullable().optional(),
    references: taskReferencesSchema.optional(),
  })
  .refine(
    (v) =>
      v.dueDate !== undefined ||
      v.title !== undefined ||
      v.completed !== undefined ||
      v.status !== undefined ||
      v.priority !== undefined ||
      v.assigneeId !== undefined ||
      v.references !== undefined ||
      v.sectionId !== undefined ||
      v.content !== undefined,
    "Provide a task change",
  )
  .refine(
    (v) =>
      v.status === undefined ||
      v.completed === undefined ||
      (v.status === "done") === v.completed,
    "Status and completion must agree",
  );
export const deleteTaskSchema = listMutationSchema.extend({ taskId: idSchema });
// Keep uploads below Vercel's function request limit, including MCP base64.
export const taskImageLimit = 3 * 1024 * 1024;
export const taskImageCountLimit = 20;
export const taskImageUploadSchema = listMutationSchema.extend({
  taskId: idSchema,
});
export const taskImageBase64Schema = taskImageUploadSchema.extend({
  imageBase64: z
    .string()
    .min(4)
    .max(4 * Math.ceil(taskImageLimit / 3)),
});
export type TaskImage = {
  id: string;
  width: number;
  height: number;
  bytes: number;
};
export function taskImagePath(id: string) {
  return `/api/v1/attachments/${id}`;
}
export function taskImageId(value: string): string | null {
  return (
    /^\/api\/v1\/attachments\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(
      value,
    )?.[1] ?? null
  );
}
export const reorderTasksSchema = listMutationSchema.extend({
  parentTaskId: idSchema.nullable().optional(),
  taskIds: z.array(idSchema).max(1000),
});
export const inviteSchema = listMutationSchema.extend({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
export const invitationResponseSchema = operationSchema.extend({
  invitationId: idSchema,
  accept: z.boolean(),
});
export const cancelInvitationSchema = listMutationSchema.extend({
  invitationId: idSchema,
});
export const removeMemberSchema = listMutationSchema.extend({
  userId: z.string().min(1).max(200),
});
export type SharedPerson = { id: string; name: string; email: string };
export type PendingInvitation = {
  id: string;
  email: string;
  expiresAt: string;
};
export type ListSharing = {
  listId: string;
  version: number;
  owner: SharedPerson;
  members: SharedPerson[];
  invitations: PendingInvitation[];
};
export type IncomingInvitation = {
  id: string;
  listId: string;
  listTitle: string;
  ownerName: string;
  ownerEmail: string;
  expiresAt: string;
};

export type Task = {
  id: string;
  key: string;
  path: string;
  status: z.infer<typeof taskStatusSchema>;
  priority: z.infer<typeof taskPrioritySchema>;
  assigneeId: string | null;
  references: TaskReference[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  dueDate: string | null;
  parentTaskId: string | null;
  content: string;
  title: string;
  completed: boolean;
  position: number;
  sectionId: string | null;
  images?: TaskImage[];
  github?: GithubTaskSummary | null;
};
export type ListSection = { id: string; title: string; position: number };
export type ListNesting = { listId: string; parentListId: string };
export type ListOrder = {
  version: number;
  listIds: string[];
  nesting?: ListNesting[];
  collapsedListIds?: string[];
  favoriteListIds?: string[];
};
export type TodoList = {
  personalView?: PersonalListView;
  id: string;
  mode: (typeof listModes)[number];
  assignees: { id: string; name: string }[];
  title: string;
  ownerId: string;
  shared: boolean;
  version: number;
  color: ListColor;
  description: string;
  archived: boolean;
  sections: ListSection[];
  tasks: Task[];
  github?: {
    repository: string;
    active: boolean;
    autoCreateIssues: boolean;
  } | null;
};
export type TaskDetail = { list: TodoList; task: Task };
export type ListSummary = Pick<
  TodoList,
  "id" | "title" | "ownerId" | "shared" | "version" | "color" | "archived"
> & {
  parentListId?: string | null;
  favorite?: boolean;
  sidebarCollapsed?: boolean;
};

// Drop inaccessible references before projecting personal navigation. Lists never
// inherit membership, content, or ownership through this preference.
export function accessibleListNesting(ids: string[], nesting: ListNesting[]) {
  const known = new Set(ids);
  const parents = new Map(
    nesting.map((entry) => [entry.listId, entry.parentListId]),
  );
  return nesting.filter(
    ({ listId, parentListId }) =>
      known.has(listId) &&
      known.has(parentListId) &&
      listId !== parentListId &&
      !parents.has(parentListId),
  );
}
export function sidebarGroups(lists: ListSummary[], archived: boolean) {
  const visible = lists.filter(
    (list) => list.archived === archived && (archived || !list.favorite),
  );
  const visibleIds = new Set(visible.map((list) => list.id));
  const parent = (list: ListSummary) =>
    list.parentListId && visibleIds.has(list.parentListId)
      ? list.parentListId
      : null;
  return visible
    .filter((list) => !parent(list))
    .map((list) => ({
      list,
      children: visible.filter((child) => parent(child) === list.id),
    }));
}

export const scopes = [
  "lists:read",
  "tasks:write",
  "lists:manage",
  "github:manage",
  "agents:manage",
] as const;
export type Scope = (typeof scopes)[number];
export type Actor = { id: string; scopes: readonly string[] };

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export const viewSorts = ["manual", "priority", "due", "updated"] as const;
export const viewColumns = ["status", "priority", "assignee", "due"] as const;
export const listViewSettingsSchema = z
  .object({
    search: z.string().trim().max(300).default(""),
    sections: z.array(idSchema.nullable()).max(51).default([]),
    statuses: z.array(z.enum(taskStatuses)).max(5).default([]),
    priorities: z.array(z.enum(taskPriorities)).max(5).default([]),
    assignees: z
      .array(z.string().min(1).max(200).nullable())
      .max(100)
      .default([]),
    due: z
      .enum(["all", "overdue", "today", "upcoming", "no_date"])
      .default("all"),
    completed: z.enum(["all", "hide", "only"]).default("all"),
    groupBy: z.enum(["section", "status", "date"]).default("section"),
    sortBy: z.enum(viewSorts).default("manual"),
    sectionSorts: z
      .array(
        z
          .object({ sectionId: idSchema.nullable(), sortBy: z.enum(viewSorts) })
          .strict(),
      )
      .max(51)
      .default([]),
    layout: z.enum(["compact", "detailed"]).default("compact"),
    collapsed: z.array(z.string().max(80)).max(200).default([]),
    columns: z
      .array(z.enum(viewColumns))
      .max(4)
      .refine(
        (columns) => new Set(columns).size === columns.length,
        "Columns must be unique",
      )
      .default([...viewColumns]),
    rowStyle: z.enum(["list", "columns"]).default("columns"),
  })
  .strict();
export const viewPresetSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(60),
    settings: listViewSettingsSchema,
  })
  .strict();
const extendedListViewSchema = listViewSettingsSchema.extend({
  presets: z.array(viewPresetSchema).max(20).default([]),
  activePresetId: z
    .union([idSchema, z.enum(["default", "open", "due", "mine", "blocked"])])
    .nullable()
    .default(null),
});
export const listViewSchema = extendedListViewSchema.superRefine(
  (view, ctx) => {
    if (
      new Set(view.presets.map((p) => p.id)).size !== view.presets.length ||
      new Set(view.presets.map((p) => p.name.toLowerCase())).size !==
        view.presets.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Preset names and IDs must be unique",
        path: ["presets"],
      });
    if (
      view.activePresetId &&
      !["default", "open", "due", "mine", "blocked"].includes(
        view.activePresetId,
      ) &&
      !view.presets.some((p) => p.id === view.activePresetId)
    )
      ctx.addIssue({
        code: "custom",
        message: "The selected preset no longer exists",
        path: ["activePresetId"],
      });
    if (new Set(view.columns).size !== view.columns.length)
      ctx.addIssue({
        code: "custom",
        message: "Columns must be unique",
        path: ["columns"],
      });
  },
);
export type ViewSettings = z.infer<typeof listViewSettingsSchema>;
export type ViewPreset = z.infer<typeof viewPresetSchema>;
export type ListView = z.infer<typeof listViewSchema>;
export type PersonalListView = { version: number; view: ListView };
export const defaultListView = (): ListView => listViewSchema.parse({});
export function viewSettings(view: ListView): ViewSettings {
  const { presets: _presets, activePresetId: _active, ...settings } = view;
  return settings;
}
export function starterViews(userId: string, work: boolean) {
  const base = viewSettings(defaultListView());
  return [
    { id: "default", name: "Default", settings: base },
    {
      id: "open",
      name: "Open tasks",
      settings: { ...base, completed: "hide" as const },
    },
    {
      id: "due",
      name: "By due date",
      settings: {
        ...base,
        completed: "hide" as const,
        sortBy: "due" as const,
        groupBy: "date" as const,
      },
    },
    ...(work
      ? [
          {
            id: "mine",
            name: "My open tasks",
            settings: {
              ...base,
              completed: "hide" as const,
              assignees: [userId],
            },
          },
          {
            id: "blocked",
            name: "Blocked",
            settings: {
              ...base,
              statuses: ["blocked" as const],
              completed: "hide" as const,
            },
          },
        ]
      : []),
  ];
}

export const updateListViewSchema = z
  .object({
    listId: idSchema,
    viewVersion: versionSchema,
    view: extendedListViewSchema
      .omit({
        presets: true,
        activePresetId: true,
        columns: true,
        rowStyle: true,
      })
      .extend({
        presets: z.array(viewPresetSchema).max(20).optional(),
        activePresetId: z
          .union([
            idSchema,
            z.enum(["default", "open", "due", "mine", "blocked"]),
          ])
          .nullable()
          .optional(),
        columns: z.array(z.enum(viewColumns)).max(4).optional(),
        rowStyle: z.enum(["list", "columns"]).optional(),
      }),
  })
  .extend(operationSchema.shape);
export const queryListViewSchema = z.object({
  listId: idSchema,
  today: dueDateSchema,
});
export const statusLabels: Record<Task["status"], string> = {
  todo: "Todo",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};
export type ViewGroup = {
  id: string;
  title: string;
  sectionId?: string | null;
  sortBy: ListView["sortBy"];
  tasks: Task[];
  childMatches: Record<string, string[]>;
};
export function projectListView(
  list: TodoList,
  view: ListView,
  today: string,
): ViewGroup[] {
  const children = new Map<string, Task[]>();
  for (const t of list.tasks)
    if (t.parentTaskId)
      children.set(t.parentTaskId, [
        ...(children.get(t.parentTaskId) ?? []),
        t,
      ]);
  const matches = (t: Task, sectionId: string | null) => {
    const search = view.search.toLowerCase();
    return (
      (!search || `${t.title} ${t.key}`.toLowerCase().includes(search)) &&
      (!view.sections.length || view.sections.includes(sectionId)) &&
      (!view.statuses.length || view.statuses.includes(t.status)) &&
      (!view.priorities.length || view.priorities.includes(t.priority)) &&
      (!view.assignees.length || view.assignees.includes(t.assigneeId)) &&
      (view.completed === "all" ||
        (view.completed === "only") === t.completed) &&
      (view.due === "all" ||
        (view.due === "no_date"
          ? !t.dueDate
          : !!t.dueDate &&
            (view.due === "today"
              ? t.dueDate === today
              : view.due === "overdue"
                ? t.dueDate < today
                : t.dueDate > today)))
    );
  };
  const groups: ViewGroup[] = [];
  if (view.groupBy === "section")
    for (const s of [
      { id: null, title: list.sections.length ? "No section" : "Tasks" },
      ...list.sections,
    ])
      groups.push({
        id: `section:${s.id ?? "none"}`,
        title: s.title,
        sectionId: s.id,
        sortBy:
          view.sectionSorts.find((o) => o.sectionId === s.id)?.sortBy ??
          view.sortBy,
        tasks: [],
        childMatches: {},
      });
  if (view.groupBy === "status")
    for (const s of taskStatuses)
      groups.push({
        id: `status:${s}`,
        title: statusLabels[s],
        sortBy: view.sortBy,
        tasks: [],
        childMatches: {},
      });
  for (const task of list.tasks.filter((t) => !t.parentTaskId)) {
    const childMatches = (children.get(task.id) ?? [])
      .filter((t) => matches(t, task.sectionId))
      .map((t) => t.id);
    if (!matches(task, task.sectionId) && !childMatches.length) continue;
    const id =
      view.groupBy === "section"
        ? `section:${task.sectionId ?? "none"}`
        : view.groupBy === "status"
          ? `status:${task.status}`
          : `date:${task.dueDate ?? "none"}`;
    let group = groups.find((g) => g.id === id);
    if (!group) {
      group = {
        id,
        title: task.dueDate ?? "No due date",
        sortBy: view.sortBy,
        tasks: [],
        childMatches: {},
      };
      groups.push(group);
    }
    group.tasks.push(task);
    if (!matches(task, task.sectionId))
      group.childMatches[task.id] = childMatches;
  }
  const priority = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 };
  for (const group of groups)
    group.tasks.sort((a, b) => {
      const tie = a.position - b.position || a.id.localeCompare(b.id);
      if (group.sortBy === "priority")
        return priority[b.priority] - priority[a.priority] || tie;
      if (group.sortBy === "updated")
        return b.updatedAt.localeCompare(a.updatedAt) || tie;
      if (group.sortBy === "due")
        return a.dueDate === b.dueDate
          ? tie
          : !a.dueDate
            ? 1
            : !b.dueDate
              ? -1
              : a.dueDate.localeCompare(b.dueDate);
      return tie;
    });
  if (view.groupBy === "date")
    groups.sort((a, b) =>
      a.id === "date:none"
        ? 1
        : b.id === "date:none"
          ? -1
          : a.id.localeCompare(b.id),
    );
  return groups;
}

// GitHub bindings are owner-managed; sync operations retain list/version checks.
export const githubBindingSchema = listMutationSchema.extend({
  installationId: z.number().int().positive().safe(),
  repositoryId: z.number().int().positive().safe(),
  shareWithList: z.literal(true),
  autoCreateIssues: z.boolean().optional(),
});
export const githubTaskSchema = listMutationSchema.extend({ taskId: idSchema });
export const githubLinkSchema = githubTaskSchema.extend({
  issueNumber: z.number().int().positive().optional(),
});
export const githubResolveSchema = githubTaskSchema.extend({
  revision: z.number().int().nonnegative(),
  choice: z.enum(["wuff", "github"]),
});
export type GithubSyncFields = { title: string; body: string; closed: boolean };
export type GithubTaskState = {
  taskId: string;
  issueNumber: number | null;
  url: string | null;
  state: string;
  revision: number;
  error: string | null;
  conflict: { wuff: GithubSyncFields; github: GithubSyncFields } | null;
};
export type GithubTaskSummary = Pick<
  GithubTaskState,
  "issueNumber" | "url" | "state"
> & { active: boolean };
export function githubSyncLabel(link: GithubTaskSummary) {
  if (!link.active) return "Disconnected";
  if (link.state === "synced") return "Synced";
  if (link.state === "conflict" || link.state === "failed")
    return "Needs attention";
  return "Pending";
}

export type GithubPullRequest = {
  number: number;
  title: string;
  url: string;
  state: "draft" | "open" | "closed" | "merged";
  headSha: string;
  review: "approved" | "changes_requested" | "pending" | "unavailable";
  checks: "passing" | "failing" | "pending" | "none" | "unavailable";
};

// First-party native OAuth configuration, shared by client and authorization server.
export const tauriClientId = "wuff-tauri-v1";
export const tauriRedirectUri =
  "com.timbenniks.wufftodo.tauri://oauth/callback";
export const nativeClientId = "wuff-native-v1";
export const nativeRedirectUri = "com.timbenniks.wufftodo://oauth/callback";
export const nativeScopes = [
  "lists:read",
  "tasks:write",
  "lists:manage",
] as const;
// Optional privileges require a new interactive authorization, never refresh.
export const nativeAllowedScopes = [...nativeScopes, "github:manage"] as const;

export const agentBindingSchema = listMutationSchema.extend({
  environmentId: idSchema,
  requiredSecrets: z
    .array(z.string().regex(/^[A-Z_][A-Z0-9_]{0,127}$/))
    .max(50)
    .default([]),
  shareWithList: z.literal(true),
});
export const agentEnvironmentSchema = listMutationSchema.extend({
  name: z.string().trim().min(1).max(100),
  install: z.string().max(4000).default("pnpm install --frozen-lockfile"),
  start: z.string().max(4000).default(""),
});
export const agentLaunchSchema = listMutationSchema.extend({
  taskId: idSchema,
  message: z.string().trim().max(16000).default(""),
  mode: z.enum(["plan", "agent"]).default("plan"),
  confirmed: z.literal(true),
});
export const agentMessageSchema = agentLaunchSchema.extend({
  message: z.string().trim().min(1).max(16000),
});
export const agentCancelSchema = operationSchema.extend({
  taskId: idSchema,
  runId: idSchema,
});
export const agentRecoverSchema = agentCancelSchema.extend({
  providerRunId: z.string().regex(/^run-[a-f0-9-]{36}$/i),
  confirmed: z.literal(true),
});
export type AgentRun = {
  id: string;
  providerRunId: string | null;
  status: string;
  mode: string;
  prompt: string;
  result: string | null;
  pullRequestUrls: string[];
  error: string | null;
  createdAt: string;
};
export type AgentTaskState = {
  conversation: { agentId: string; url: string } | null;
  runs: AgentRun[];
};

export * from "./reminders";

export const dashboardSections = ["today", "upcoming", "favorites"] as const;
export type DashboardSection = (typeof dashboardSections)[number];
export const defaultDashboardSettings = {
  sections: [...dashboardSections],
  hidden: [] as DashboardSection[],
  startPage: "home" as "home" | "last_list",
};
export const dashboardSettingsSchema = z
  .object({
    sections: z
      .array(z.enum(dashboardSections))
      .length(3)
      .refine((v) => new Set(v).size === 3, "Include each section once"),
    hidden: z
      .array(z.enum(dashboardSections))
      .max(3)
      .refine((v) => new Set(v).size === v.length, "Choose each section once"),
    startPage: z.enum(["home", "last_list"]),
  })
  .strict();
export type DashboardSettings = z.infer<typeof dashboardSettingsSchema>;
export type DashboardPreferences = {
  version: number;
  settings: DashboardSettings;
};
export const dashboardQuerySchema = z
  .object({
    today: dueDateSchema,
    limit: z.number().int().min(1).max(100).default(5),
  })
  .strict();
export const updateDashboardSchema = operationSchema.extend({
  version: versionSchema,
  settings: dashboardSettingsSchema,
});
export type DashboardTask = {
  id: string;
  title: string;
  path: string;
  dueDate: string;
  parentTaskId: string | null;
  parentTitle: string | null;
  list: ListSummary;
};
export type Dashboard = {
  name: string;
  today: string;
  through: string;
  preferences: DashboardPreferences;
  todayTasks: DashboardTask[];
  upcomingTasks: DashboardTask[];
  todayTotal: number;
  upcomingTotal: number;
  favorites: ListSummary[];
};
export function dashboardThrough(today: string) {
  dueDateSchema.parse(today);
  const time = new Date(`${today}T12:00:00Z`).getTime();
  return new Date(
    Math.min(time + 7 * 86400000, new Date("9999-12-31T12:00:00Z").getTime()),
  )
    .toISOString()
    .slice(0, 10);
}
