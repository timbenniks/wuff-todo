import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNoteSchema,
  noteMutationSchema,
  noteTagsSchema,
  noteQuerySchema,
  boardBodySchema,
  noteTaskSchema,
  noteTaskContent,
  noteExcerpt,
  notesSettingsSchema,
  noteImageSchema,
  scopes,
  mcpToolAllowed,
  empireAppPreference,
} from "@wuff/contracts";
import { authorizationScopes } from "../apps/web/src/lib/oauth";
import { signInReturnPath } from "../apps/web/src/lib/auth/return-path";
import {
  moveNoteCard,
  uncertainNotesError,
  canReplaceNoteDraft,
} from "../packages/ui/src/modules/notes/recovery";
import { featureApi } from "../apps/native/src/feature-api";
const id = () => crypto.randomUUID();
test("Notes creation validates content/title/mode/theme, normalizes tags and starts with explicit private fields", () => {
  const note = createNoteSchema.parse({
    title: "  An idea  ",
    operationId: id(),
    tags: ["Home", "home", " Ideas "],
  });
  assert.equal(note.title, "An idea");
  assert.equal(note.content, "");
  assert.equal(note.mode, undefined);
  assert.deepEqual(note.tags, ["home", "ideas"]);
  for (const patch of [
    { title: " " },
    { content: "a".repeat(16001) },
    { mode: "canvas" },
    { theme: "neon" },
    { ownerId: id() },
    { userId: id() },
    { shared: true },
  ])
    assert(
      !createNoteSchema.safeParse({
        title: "Valid",
        operationId: id(),
        ...patch,
      }).success,
    );
  assert(
    !noteTagsSchema.safeParse(Array.from({ length: 21 }, (_, i) => String(i)))
      .success,
  );
  assert(!noteTagsSchema.safeParse(["x".repeat(41)]).success);
});
test("Notes search is bounded and rejects unsupported filters and pagination", () => {
  assert.deepEqual(noteQuerySchema.parse({}), {
    search: "",
    filter: "all",
    limit: 50,
    offset: 0,
  });
  for (const input of [
    { search: "x".repeat(201) },
    { filter: "everyone" },
    { limit: 0 },
    { limit: 101 },
    { offset: -1 },
    { offset: 5001 },
  ])
    assert(!noteQuerySchema.safeParse(input).success);
});
test("moodboard cards validate discriminated content, safe non-fetching links and target identities", () => {
  for (const body of [
    { kind: "text", text: "**Idea**" },
    { kind: "image", assetId: id() },
    { kind: "note", targetId: id() },
    { kind: "link", title: "Reference", url: "https://example.com/path" },
  ])
    assert(boardBodySchema.safeParse(body).success);
  for (const body of [
    { kind: "html", text: "<script>" },
    { kind: "text", text: "x".repeat(8001) },
    { kind: "image", assetId: "https://example.com/image" },
    { kind: "note", targetId: "other" },
    ...[
      "javascript:alert(1)",
      "data:text/html,test",
      "https://user:pass@example.com",
      "ftp://example.com",
    ].map((url) => ({ kind: "link", title: "Reference", url })),
  ])
    assert(!boardBodySchema.safeParse(body).success);
});
test("Notes mutations require scoped identity/version and reject spoofing, incomplete saves and duplicate ordering", () => {
  const base = { operationId: id(), noteId: id(), version: 0 };
  for (const change of [
    {
      action: "preference",
      preferenceVersion: 0,
      pinned: true,
      archived: false,
    },
    { action: "share", email: "A@EXAMPLE.INVALID", role: "viewer" },
    { action: "trash" },
    { action: "link", targetId: id() },
    { action: "add_card", body: { kind: "text", text: "hi" } },
  ])
    assert(noteMutationSchema.safeParse({ ...base, change }).success);
  const card = id();
  for (const change of [
    { action: "save", title: "missing content fields" },
    { action: "share", email: "a@example.invalid", role: "owner" },
    { action: "preference", pinned: true, archived: false },
    { action: "reorder_cards", cardIds: [card, card] },
    { action: "delete_everything" },
  ])
    assert(!noteMutationSchema.safeParse({ ...base, change }).success);
  assert(
    !noteMutationSchema.safeParse({
      ...base,
      actorId: id(),
      change: { action: "trash" },
    }).success,
  );
});
test("Todo export requires explicit destination/version/confirmation and strips images without exceeding task limits", () => {
  const base = {
    operationId: id(),
    noteId: id(),
    version: 0,
    listId: id(),
    listVersion: 1,
    title: "A task",
    confirmed: true,
  };
  assert.equal(noteTaskSchema.parse(base).includeContent, false);
  assert(!noteTaskSchema.safeParse({ ...base, confirmed: false }).success);
  assert(!noteTaskSchema.safeParse({ ...base, listVersion: -1 }).success);
  const without = noteTaskContent(
    base.noteId,
    "Private content",
    false,
    "https://wuff.example.invalid",
  );
  assert(!without.includes("Private content"));
  assert(without.includes(`/notes?note=${base.noteId}`));
  const copy = noteTaskContent(
    base.noteId,
    "Hello ![secret](https://example.com/image) world",
    true,
    "https://wuff.example.invalid",
  );
  assert(!copy.includes("example.com/image"));
  assert(copy.includes("Hello"));
  assert(copy.includes("Source note"));
  assert(
    noteTaskContent(
      base.noteId,
      "x".repeat(16000),
      true,
      "https://wuff.example.invalid",
    ).length <= 16000,
  );
});
test("Notes defaults, dashboard preferences and MCP permissions are independent from module visibility", () => {
  assert.deepEqual(empireAppPreference({}, "notes"), {
    visible: true,
    dashboard: false,
  });
  assert.deepEqual(notesSettingsSchema.parse({}), {
    defaultMode: "note",
    defaultTheme: "blue",
    dashboard: "pinned",
    dashboardLimit: 4,
  });
  assert(!notesSettingsSchema.safeParse({ dashboardLimit: 9 }).success);
  assert(
    !authorizationScopes(null, "synthetic").some((s) => s.startsWith("notes:")),
  );
  assert(!mcpToolAllowed("get_note", ["lists:read"], null));
  assert(mcpToolAllowed("get_note", ["notes:read"], null));
  assert(!mcpToolAllowed("get_note", scopes, []));
  assert(mcpToolAllowed("manage_note", ["notes:read", "notes:manage"], null));
  assert(!mcpToolAllowed("manage_note", ["notes:read", "notes:write"], null));
  assert(
    !mcpToolAllowed("create_note_task", ["notes:read", "notes:write"], null),
  );
  assert(
    mcpToolAllowed(
      "create_note_task",
      ["notes:read", "lists:read", "tasks:write"],
      null,
    ),
  );
});
test("Notes image envelopes are bounded and reject foreign identities and malformed request fields", () => {
  const base = {
    operationId: id(),
    noteId: id(),
    version: 1,
    imageBase64: "AAAA",
  };
  assert(noteImageSchema.safeParse(base).success);
  assert(!noteImageSchema.safeParse({ ...base, userId: id() }).success);
  assert(
    !noteImageSchema.safeParse({
      ...base,
      imageBase64: "a".repeat(4 * 1024 * 1024 + 1),
    }).success,
  );
});
test("draft recovery preserves ambiguous requests and rejects invalid card moves without mutating source order", () => {
  assert(uncertainNotesError(new Error("network")));
  assert(uncertainNotesError({ status: 500, code: "internal_error" }));
  assert(!uncertainNotesError({ status: 409, code: "conflict" }));
  assert(!uncertainNotesError({ status: 403 }));
  assert(!uncertainNotesError({ status: 503, code: "images_unavailable" }));
  assert(canReplaceNoteDraft(false, false, false));
  for (const flags of [
    [true, false, false],
    [false, true, false],
    [false, false, true],
  ] as const)
    assert(!canReplaceNoteDraft(flags[0], flags[1], flags[2]));
  const order = ["a", "b", "c"];
  assert.deepEqual(moveNoteCard(order, "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveNoteCard(order, "a", -1), order);
  assert.deepEqual(moveNoteCard(order, "missing", 1), order);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(
    noteExcerpt("# Hello\n**world** ![image](https://example.invalid)"),
    "Hello world",
  );
});
test("Notes sign-in return paths preserve explicit app routes without accepting open redirects", () => {
  const note = id();
  for (const path of [
    "/notes",
    `/notes?note=${note}`,
    "/notes?filter=archived",
    "/settings/notes",
  ])
    assert.equal(signInReturnPath(path), path);
  for (const path of [
    "/notes?next=//evil.invalid",
    `/notes?note=${note}&next=//evil.invalid`,
    "/notes?filter=evil",
    "//notes",
  ])
    assert.equal(signInReturnPath(path), "/");
});
test("native Notes adapter maps only supported operations and pins the account", async () => {
  const calls: { action: string; input: unknown; userId?: string }[] = [];
  const api = featureApi(
    {
      call: async <T>(action: string, input: unknown, userId?: string) => {
        calls.push({ action, input, userId });
        return {} as T;
      },
    },
    "synthetic-native",
  );
  await api("/api/v1/notes?search=idea&filter=pinned");
  await api(`/api/v1/notes/${id()}`);
  await api("/api/v1/notes/settings", "PUT", { version: 0 });
  await api("/api/v1/notes/export", "POST", { confirmed: true });
  await api(`/api/v1/notes/images/${id()}`);
  assert.deepEqual(
    calls.map((c) => c.action),
    [
      "searchNotes",
      "getNote",
      "updateNotesSettings",
      "createNoteTask",
      "getNoteImage",
    ],
  );
  assert(calls.every((c) => c.userId === "synthetic-native"));
  await assert.rejects(() => api("https://evil.invalid/api/v1/notes"));
});

test("note roles separate shared editing, owner management, personal choices and explicit Todo access", async () => {
  const { noteCapabilities } = await import("@wuff/contracts");
  const full = [
    "notes:read",
    "notes:write",
    "notes:manage",
    "lists:read",
    "tasks:write",
  ];
  assert.deepEqual(noteCapabilities("owner", false, full), {
    canEdit: true,
    canManage: true,
    canPersonalize: true,
    canExport: true,
  });
  assert.deepEqual(noteCapabilities("editor", false, full), {
    canEdit: true,
    canManage: false,
    canPersonalize: true,
    canExport: true,
  });
  assert.deepEqual(noteCapabilities("viewer", false, full), {
    canEdit: false,
    canManage: false,
    canPersonalize: true,
    canExport: true,
  });
  assert.deepEqual(noteCapabilities("outsider", false, full), {
    canEdit: false,
    canManage: false,
    canPersonalize: false,
    canExport: false,
  });
  assert.deepEqual(noteCapabilities("owner", true, full), {
    canEdit: false,
    canManage: true,
    canPersonalize: false,
    canExport: false,
  });
  assert(!noteCapabilities("owner", false, ["notes:read"]).canEdit);
  assert(
    !noteCapabilities("owner", false, ["notes:read", "notes:write"]).canManage,
  );
  assert(
    noteCapabilities("owner", false, ["notes:read", "notes:manage"]).canManage,
  );
  assert(
    !noteCapabilities("owner", false, ["notes:read", "notes:write"]).canExport,
  );
});
test("moodboard projections hide inaccessible note identities and only hydrate ready bound images", async () => {
  const { projectNoteCards } = await import("@wuff/contracts");
  const target = id(),
    asset = id(),
    card = id();
  const input = [
    {
      id: card,
      position: 0,
      body: { kind: "note" as const, targetId: target },
    },
    {
      id: id(),
      position: 1,
      body: { kind: "image" as const, assetId: asset, caption: "Private" },
    },
  ];
  const hidden = projectNoteCards(
    input,
    [],
    new Set(),
    (id) => `/images/${id}`,
  );
  assert.deepEqual(hidden[0], {
    id: card,
    position: 0,
    body: { kind: "note", unavailable: true },
  });
  assert(!JSON.stringify(hidden).includes(target));
  assert(!hidden[1].imagePath);
  const visible = projectNoteCards(
    input,
    [
      {
        id: target,
        title: "Allowed note",
        mode: "note",
        path: `/notes?note=${target}`,
      },
    ],
    new Set([asset]),
    (id) => `/images/${id}`,
  );
  assert.equal(visible[0].target?.title, "Allowed note");
  assert.equal(visible[1].imagePath, `/images/${asset}`);
  assert.equal(input[0].body.kind, "note");
});

test("MCP editing and management schemas cannot bypass individual tool choices", async () => {
  const { noteEditSchema, noteManageSchema } = await import("@wuff/contracts");
  const base = { noteId: id(), version: 1, operationId: id() };
  assert(
    noteEditSchema.safeParse({ ...base, change: { action: "leave" } }).success,
  );
  assert(
    !noteEditSchema.safeParse({ ...base, change: { action: "trash" } }).success,
  );
  assert(
    !noteEditSchema.safeParse({
      ...base,
      change: {
        action: "share",
        email: "viewer@example.invalid",
        role: "viewer",
      },
    }).success,
  );
  assert(
    noteManageSchema.safeParse({ ...base, change: { action: "trash" } })
      .success,
  );
  assert(
    !noteManageSchema.safeParse({
      ...base,
      change: {
        action: "preference",
        preferenceVersion: 0,
        pinned: true,
        archived: false,
      },
    }).success,
  );
});

test("native image uploads share the 3 MiB contract while other envelopes remain bounded", async () => {
  const { nativeInput } = await import("../apps/web/src/lib/native-input");
  const request = (value: unknown) =>
    new Request("http://localhost/api/mobile", {
      method: "POST",
      body: JSON.stringify(value),
    });
  const payload = "a".repeat(150000);
  assert.equal(
    (
      (await nativeInput(
        request({ action: "uploadNoteImage", input: { imageBase64: payload } }),
      )) as any
    ).input.imageBase64,
    payload,
  );
  await assert.rejects(
    () => nativeInput(request({ action: "updateNote", input: payload })),
    { code: "too_large" },
  );
  await assert.rejects(
    () =>
      nativeInput(
        new Request("http://localhost/api/mobile", {
          method: "POST",
          body: "{",
        }),
      ),
    { code: "invalid_json" },
  );
  await assert.rejects(
    () =>
      nativeInput(
        request({
          action: "uploadNoteImage",
          input: "a".repeat(4 * 1024 * 1024 + 20000),
        }),
      ),
    { code: "too_large" },
  );
});

test("Notes-only MCP consent accepts its own read root and never expands legacy defaults", () => {
  assert.deepEqual(
    authorizationScopes("notes:read notes:write", "third-party"),
    ["notes:read", "notes:write"],
  );
  assert.throws(() => authorizationScopes("notes:write", "third-party"));
  assert(
    !authorizationScopes(null, "third-party").some((s) =>
      s.startsWith("notes:"),
    ),
  );
});

test("Notes dates stay stable between server and browser locales/timezones", async () => {
  const { noteDateLabel } =
    await import("../packages/ui/src/modules/notes/recovery");
  assert.equal(noteDateLabel("2026-10-25T00:15:00.000Z"), "25/10/2026");
  assert.equal(noteDateLabel("2026-10-25T23:59:59.000Z"), "25/10/2026");
  assert.equal(noteDateLabel("2026-10-26T00:15:00+02:00"), "25/10/2026");
});
