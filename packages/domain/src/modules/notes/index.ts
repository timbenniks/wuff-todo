import { createHash, randomUUID } from "node:crypto";
import {
  and,
  or,
  eq,
  exists,
  isNull,
  isNotNull,
  sql,
  desc,
  asc,
  inArray,
  ne,
} from "drizzle-orm";
import {
  database,
  users,
  receipts,
  notes,
  noteMembers,
  notePreferences,
  noteLinks,
  noteCards,
  noteAssets,
  notesSettings,
  noteTasks,
  tasks,
  lists,
  members,
} from "@wuff/db";
import {
  AppError,
  noteCapabilities,
  noteRoleCanEdit,
  noteRoleCanManage,
  projectNoteCards,
  createNoteSchema,
  noteMutationSchema,
  noteQuerySchema,
  noteImageSchema,
  noteTaskSchema,
  updateNotesSettingsSchema,
  notesSettingsSchema,
  notePath,
  noteImagePath,
  noteExcerpt,
  noteTaskContent,
  boardBodySchema,
  type Actor,
  type NoteSummary,
  type NoteDetail,
  type NoteMutation,
  type BoardBody,
  type NotesSettings,
} from "@wuff/contracts";
import {
  admission,
  requireScope,
  type Db,
  type Tx,
} from "../../platform/access";
import {
  decodeTaskImage,
  normalizeTaskImage,
  storeTaskImage,
  loadTaskImage,
  imageStorageConfigured,
} from "../../platform/image-storage";
import { createTaskInTransaction, getTask } from "../todo";
const fail = (code: string, message: string, status = 400): never => {
  throw new AppError(code, message, status);
};
type Row = typeof notes.$inferSelect;
function visible(actor: Actor) {
  return or(
    eq(notes.ownerId, actor.id),
    exists(
      database()
        .db.select({ id: noteMembers.noteId })
        .from(noteMembers)
        .where(
          and(
            eq(noteMembers.noteId, notes.id),
            eq(noteMembers.userId, actor.id),
          ),
        ),
    ),
  );
}
async function admitted(db: Db | Tx, actor: Actor, scope = "notes:read") {
  requireScope(actor, "notes:read");
  requireScope(actor, scope);
  await admission(db, actor);
}
async function access(db: Db | Tx, actor: Actor, id: string, lock = false) {
  await admitted(db, actor);
  const query = db.select().from(notes).where(eq(notes.id, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) fail("not_found", "Note not found.", 404);
  const [member] =
    row.ownerId === actor.id
      ? []
      : await db
          .select()
          .from(noteMembers)
          .where(
            and(eq(noteMembers.noteId, id), eq(noteMembers.userId, actor.id)),
          );
  const role = row.ownerId === actor.id ? "owner" : member?.role;
  if (!role || (row.deletedAt && role !== "owner"))
    fail("not_found", "Note not found.", 404);
  return { row, role: role as "owner" | "viewer" | "editor" };
}
async function preferences(db: Db | Tx, actor: Actor, id: string) {
  return (
    await db
      .select()
      .from(notePreferences)
      .where(
        and(
          eq(notePreferences.noteId, id),
          eq(notePreferences.userId, actor.id),
        ),
      )
  )[0];
}
async function summary(
  db: Db | Tx,
  actor: Actor,
  row: Row,
  role?: "owner" | "viewer" | "editor",
): Promise<NoteSummary> {
  const [owner] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, row.ownerId));
  const pref = await preferences(db, actor, row.id),
    shared =
      (
        await db
          .select({ id: noteMembers.userId })
          .from(noteMembers)
          .where(eq(noteMembers.noteId, row.id))
          .limit(1)
      ).length > 0;
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: owner?.name ?? "Wuff member",
    title: row.title,
    content: noteExcerpt(row.content),
    tags: row.tags,
    mode: row.mode,
    theme: row.theme,
    version: row.version,
    role: role ?? (await access(db, actor, row.id)).role,
    shared,
    pinned: pref?.pinned ?? false,
    archived: pref?.archived ?? false,
    preferenceVersion: pref?.version ?? 0,
    trashed: !!row.deletedAt,
    updatedAt: row.updatedAt.toISOString(),
  };
}
export async function searchNotes(actor: Actor, data: unknown = {}) {
  const input = noteQuerySchema.parse(data),
    db = database().db;
  await admitted(db, actor);
  const ownPref = db
    .select({ id: notePreferences.noteId })
    .from(notePreferences)
    .where(
      and(
        eq(notePreferences.noteId, notes.id),
        eq(notePreferences.userId, actor.id),
        eq(notePreferences.archived, true),
      ),
    );
  const search = input.search.toLowerCase(),
    tag = input.tag?.toLowerCase();
  const where = and(
    visible(actor),
    input.filter === "trash"
      ? and(eq(notes.ownerId, actor.id), isNotNull(notes.deletedAt))
      : isNull(notes.deletedAt),
    input.filter === "archived"
      ? exists(ownPref)
      : input.filter === "trash"
        ? undefined
        : sql`not exists (${ownPref})`,
    input.filter === "pinned"
      ? exists(
          db
            .select({ id: notePreferences.noteId })
            .from(notePreferences)
            .where(
              and(
                eq(notePreferences.noteId, notes.id),
                eq(notePreferences.userId, actor.id),
                eq(notePreferences.pinned, true),
              ),
            ),
        )
      : undefined,
    input.filter === "shared"
      ? or(
          ne(notes.ownerId, actor.id),
          exists(
            db
              .select({ id: noteMembers.noteId })
              .from(noteMembers)
              .where(eq(noteMembers.noteId, notes.id)),
          ),
        )
      : undefined,
    tag ? sql`${notes.tags} @> ${JSON.stringify([tag])}::jsonb` : undefined,
    search
      ? or(
          sql`position(${search} in lower(${notes.title})) > 0`,
          sql`position(${search} in lower(${notes.content})) > 0`,
          sql`position(${search} in lower(${notes.tags}::text)) > 0`,
          exists(
            db
              .select({ id: noteCards.id })
              .from(noteCards)
              .where(
                and(
                  eq(noteCards.noteId, notes.id),
                  sql`position(${search} in lower(coalesce(${noteCards.body}->>'text','') || ' ' || coalesce(${noteCards.body}->>'title',''))) > 0`,
                ),
              ),
          ),
        )
      : undefined,
  );
  const rows = await db
    .select({
      row: notes,
      ownerName: users.name,
      memberRole: noteMembers.role,
      pinned: notePreferences.pinned,
      archived: notePreferences.archived,
      preferenceVersion: notePreferences.version,
      shared: exists(
        db
          .select({ id: noteMembers.userId })
          .from(noteMembers)
          .where(eq(noteMembers.noteId, notes.id)),
      ).mapWith(Boolean),
    })
    .from(notes)
    .innerJoin(users, eq(users.id, notes.ownerId))
    .leftJoin(
      noteMembers,
      and(eq(noteMembers.noteId, notes.id), eq(noteMembers.userId, actor.id)),
    )
    .leftJoin(
      notePreferences,
      and(
        eq(notePreferences.noteId, notes.id),
        eq(notePreferences.userId, actor.id),
      ),
    )
    .where(where)
    .orderBy(desc(notes.updatedAt), asc(notes.id))
    .limit(input.limit)
    .offset(input.offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::integer` })
    .from(notes)
    .where(where);
  const tagsRows = await db
    .select({ tags: notes.tags })
    .from(notes)
    .where(and(visible(actor), isNull(notes.deletedAt)))
    .limit(1000);
  return {
    userId: actor.id,
    notes: rows.map(
      ({
        row,
        ownerName,
        memberRole,
        pinned,
        archived,
        preferenceVersion,
        shared,
      }) => ({
        id: row.id,
        ownerId: row.ownerId,
        ownerName,
        title: row.title,
        content: noteExcerpt(row.content),
        tags: row.tags,
        mode: row.mode,
        theme: row.theme,
        version: row.version,
        role: (row.ownerId === actor.id
          ? "owner"
          : memberRole!) as NoteSummary["role"],
        shared,
        pinned: pinned ?? false,
        archived: archived ?? false,
        preferenceVersion: preferenceVersion ?? 0,
        trashed: !!row.deletedAt,
        updatedAt: row.updatedAt.toISOString(),
      }),
    ),
    total,
    tags: [...new Set(tagsRows.flatMap((row) => row.tags))].sort(),
  };
}
async function references(db: Db | Tx, actor: Actor, ids: string[]) {
  if (!ids.length) return [];
  return (
    await db
      .select({ id: notes.id, title: notes.title, mode: notes.mode })
      .from(notes)
      .where(
        and(inArray(notes.id, ids), visible(actor), isNull(notes.deletedAt)),
      )
  ).map((row) => ({ ...row, path: notePath(row.id) }));
}
export async function getNote(actor: Actor, id: string): Promise<NoteDetail> {
  const db = database().db,
    { row, role } = await access(db, actor, id);
  const outgoing = await db
      .select()
      .from(noteLinks)
      .where(eq(noteLinks.sourceId, id)),
    incoming = await db
      .select()
      .from(noteLinks)
      .where(eq(noteLinks.targetId, id));
  const cards = await db
    .select()
    .from(noteCards)
    .where(eq(noteCards.noteId, id))
    .orderBy(asc(noteCards.position), asc(noteCards.id));
  const cardTargets = await references(
    db,
    actor,
    cards.flatMap((c) => (c.body.kind === "note" ? [c.body.targetId] : [])),
  );
  const assets = await db
    .select()
    .from(noteAssets)
    .where(eq(noteAssets.noteId, id))
    .orderBy(asc(noteAssets.createdAt));
  const connected = actor.scopes.includes("lists:read")
    ? await db
        .select({ id: tasks.id, title: tasks.title })
        .from(noteTasks)
        .innerJoin(tasks, eq(tasks.id, noteTasks.taskId))
        .innerJoin(lists, eq(lists.id, tasks.listId))
        .where(
          and(
            eq(noteTasks.noteId, id),
            or(
              eq(lists.ownerId, actor.id),
              exists(
                db
                  .select({ id: members.userId })
                  .from(members)
                  .where(
                    and(
                      eq(members.listId, lists.id),
                      eq(members.userId, actor.id),
                    ),
                  ),
              ),
            ),
          ),
        )
    : [];
  return {
    ...(await summary(db, actor, row, role)),
    content: row.content,
    userId: actor.id,
    ...noteCapabilities(role, !!row.deletedAt, actor.scopes),
    links: await references(
      db,
      actor,
      outgoing.map((l) => l.targetId),
    ),
    backlinks: await references(
      db,
      actor,
      incoming.map((l) => l.sourceId),
    ),
    cards: projectNoteCards(
      cards,
      cardTargets,
      new Set(assets.filter((a) => a.ready).map((a) => a.id)),
      noteImagePath,
    ),
    assets: assets.map((a) => ({
      id: a.id,
      path: noteImagePath(a.id),
      width: a.width,
      height: a.height,
      ready: a.ready,
    })),
    ...(role === "owner"
      ? {
          members: await db
            .select({
              userId: noteMembers.userId,
              name: users.name,
              email: users.email,
              role: noteMembers.role,
            })
            .from(noteMembers)
            .innerJoin(users, eq(users.id, noteMembers.userId))
            .where(eq(noteMembers.noteId, id)),
        }
      : {}),
    tasks: connected.map((t) => ({ ...t, path: `/tasks/${t.id}` })),
  };
}
async function receipt(
  tx: Tx,
  actor: Actor,
  input: Record<string, unknown> & { operationId: string },
  run: () => Promise<Record<string, string>>,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${actor.id + ":" + input.operationId},0))`,
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const [old] = await tx
    .select()
    .from(receipts)
    .where(
      and(
        eq(receipts.actorId, actor.id),
        eq(receipts.operationId, input.operationId),
      ),
    );
  if (old) {
    if (old.fingerprint !== fingerprint)
      fail(
        "idempotency_conflict",
        "This operation ID was used for a different request.",
        409,
      );
    return old.result as Record<string, string>;
  }
  const result = await run();
  await tx.insert(receipts).values({
    actorId: actor.id,
    operationId: input.operationId,
    fingerprint,
    result,
  });
  return result;
}
const bump = async (tx: Tx, id: string) => {
  await tx
    .update(notes)
    .set({ version: sql`${notes.version}+1`, updatedAt: new Date() })
    .where(eq(notes.id, id));
};
function editor(role: string) {
  if (!noteRoleCanEdit(role))
    fail("forbidden", "Only the owner or an editor can change this note.", 403);
}
function active(row: Row) {
  if (row.deletedAt)
    fail("note_trashed", "Restore this note before changing it.", 409);
}
function version(row: Row, expected: number) {
  if (row.version !== expected)
    fail(
      "conflict",
      "This note changed. Your draft is kept; load the latest note before saving.",
      409,
    );
}
export async function createNote(actor: Actor, data: unknown) {
  const input = createNoteSchema.parse(data),
    db = database().db;
  const result = await db.transaction(async (tx) => {
    await admitted(tx, actor, "notes:write");
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, actor.id))
      .for("update");
    return receipt(tx, actor, { ...input, kind: "create_note" }, async () => {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::integer` })
        .from(notes)
        .where(eq(notes.ownerId, actor.id));
      if (count >= 1000)
        fail("limit_reached", "You can keep up to 1,000 notes.", 400);
      const [savedDefaults] = await tx
        .select()
        .from(notesSettings)
        .where(eq(notesSettings.userId, actor.id));
      const defaults = notesSettingsSchema.parse(savedDefaults?.settings ?? {});
      const [row] = await tx
        .insert(notes)
        .values({
          ...input,
          mode: input.mode ?? defaults.defaultMode,
          theme: input.theme ?? defaults.defaultTheme,
          ownerId: actor.id,
        })
        .returning({ id: notes.id });
      return row;
    });
  });
  return getNote(actor, result.id);
}
async function validateCard(
  tx: Tx,
  actor: Actor,
  noteId: string,
  body: BoardBody,
) {
  if (body.kind === "note") {
    if (body.targetId === noteId) fail("invalid_link", "Choose another note.");
    const target = await access(tx, actor, body.targetId);
    active(target.row);
  }
  if (body.kind === "image") {
    const [asset] = await tx
      .select()
      .from(noteAssets)
      .where(
        and(
          eq(noteAssets.id, body.assetId),
          eq(noteAssets.noteId, noteId),
          eq(noteAssets.ready, true),
        ),
      );
    if (!asset)
      fail("invalid_image", "Choose an uploaded image from this board.");
  }
}
export async function updateNote(actor: Actor, data: unknown) {
  const input = noteMutationSchema.parse(data),
    change = input.change,
    db = database().db;
  const left = change.action === "leave";
  await db.transaction(async (tx) => {
    const { row, role } = await access(tx, actor, input.noteId, true);
    const management = ["share", "unshare", "trash", "restore"].includes(
      change.action,
    );
    requireScope(actor, management ? "notes:manage" : "notes:write");
    if (management && !noteRoleCanManage(role))
      fail(
        "owner_required",
        "Only the owner can manage sharing or trash.",
        403,
      );
    if (!["preference", "leave"].includes(change.action) && !management)
      editor(role);
    if (change.action !== "restore" && change.action !== "trash") active(row);
    await receipt(tx, actor, { ...input, kind: "update_note" }, async () => {
      if (change.action !== "preference") version(row, input.version);
      if (change.action === "save") {
        const { action, ...fields } = change;
        await tx
          .update(notes)
          .set({ ...fields, updatedAt: new Date(), version: row.version + 1 })
          .where(eq(notes.id, row.id));
      } else if (change.action === "preference") {
        const pref = await preferences(tx, actor, row.id);
        if ((pref?.version ?? 0) !== change.preferenceVersion)
          fail(
            "conflict",
            "Your personal note choices changed. Load the latest choices.",
            409,
          );
        const values = {
          pinned: change.pinned,
          archived: change.archived,
          version: change.preferenceVersion + 1,
        };
        await tx
          .insert(notePreferences)
          .values({ ...values, userId: actor.id, noteId: row.id })
          .onConflictDoUpdate({
            target: [notePreferences.noteId, notePreferences.userId],
            set: values,
          });
      } else if (change.action === "share") {
        const [user] = await tx
          .select()
          .from(users)
          .where(
            and(
              sql`lower(${users.email})=${change.email}`,
              eq(users.enabled, true),
            ),
          );
        if (!user)
          fail("not_found", "Choose an existing active Wuff account.", 404);
        if (user.id === row.ownerId)
          fail("invalid_member", "The owner already has access.");
        await tx
          .insert(noteMembers)
          .values({ noteId: row.id, userId: user.id, role: change.role })
          .onConflictDoUpdate({
            target: [noteMembers.noteId, noteMembers.userId],
            set: { role: change.role },
          });
        await bump(tx, row.id);
      } else if (change.action === "unshare" || change.action === "leave") {
        const userId = change.action === "leave" ? actor.id : change.userId;
        if (userId === row.ownerId)
          fail("owner_required", "The owner cannot leave their own note.", 403);
        await tx
          .delete(noteMembers)
          .where(
            and(eq(noteMembers.noteId, row.id), eq(noteMembers.userId, userId)),
          );
        await tx
          .delete(notePreferences)
          .where(
            and(
              eq(notePreferences.noteId, row.id),
              eq(notePreferences.userId, userId),
            ),
          );
        await bump(tx, row.id);
      } else if (change.action === "trash" || change.action === "restore") {
        await tx
          .update(notes)
          .set({
            deletedAt: change.action === "trash" ? new Date() : null,
            version: row.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(notes.id, row.id));
      } else if (change.action === "link" || change.action === "unlink") {
        if (change.targetId === row.id)
          fail("invalid_link", "Choose another note.");
        if (change.action === "link") {
          const target = await access(tx, actor, change.targetId);
          active(target.row);
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::integer` })
            .from(noteLinks)
            .where(eq(noteLinks.sourceId, row.id));
          if (count >= 100)
            fail("limit_reached", "A note can link to up to 100 notes.");
          await tx
            .insert(noteLinks)
            .values({ sourceId: row.id, targetId: change.targetId })
            .onConflictDoNothing();
        } else
          await tx
            .delete(noteLinks)
            .where(
              and(
                eq(noteLinks.sourceId, row.id),
                eq(noteLinks.targetId, change.targetId),
              ),
            );
        await bump(tx, row.id);
      } else if (change.action === "add_card") {
        await validateCard(tx, actor, row.id, change.body);
        const cards = await tx
          .select()
          .from(noteCards)
          .where(eq(noteCards.noteId, row.id));
        if (cards.length >= 100)
          fail("limit_reached", "A moodboard can contain up to 100 cards.");
        await tx.insert(noteCards).values({
          noteId: row.id,
          position: Math.max(-1, ...cards.map((c) => c.position)) + 1,
          body: change.body,
        });
        await bump(tx, row.id);
      } else if (change.action === "update_card") {
        await validateCard(tx, actor, row.id, change.body);
        const changed = await tx
          .update(noteCards)
          .set({ body: change.body })
          .where(
            and(eq(noteCards.id, change.cardId), eq(noteCards.noteId, row.id)),
          )
          .returning({ id: noteCards.id });
        if (!changed.length) fail("not_found", "Card not found.", 404);
        await bump(tx, row.id);
      } else if (change.action === "remove_card") {
        await tx
          .delete(noteCards)
          .where(
            and(eq(noteCards.id, change.cardId), eq(noteCards.noteId, row.id)),
          );
        await bump(tx, row.id);
      } else if (change.action === "reorder_cards") {
        const cards = await tx
          .select()
          .from(noteCards)
          .where(eq(noteCards.noteId, row.id));
        if (
          cards.length !== change.cardIds.length ||
          cards.some((c) => !change.cardIds.includes(c.id))
        )
          fail("invalid_order", "Include every card exactly once.");
        for (const [position, id] of change.cardIds.entries())
          await tx
            .update(noteCards)
            .set({ position })
            .where(and(eq(noteCards.id, id), eq(noteCards.noteId, row.id)));
        await bump(tx, row.id);
      }
      return { id: row.id };
    });
  });
  return left ? { left: true as const } : getNote(actor, input.noteId);
}
export async function getNotesSettings(actor: Actor): Promise<NotesSettings> {
  const db = database().db;
  await admitted(db, actor);
  const [row] = await db
    .select()
    .from(notesSettings)
    .where(eq(notesSettings.userId, actor.id));
  return {
    userId: actor.id,
    version: row?.version ?? 0,
    settings: notesSettingsSchema.parse(row?.settings ?? {}),
  };
}
export async function updateNotesSettings(actor: Actor, data: unknown) {
  const input = updateNotesSettingsSchema.parse(data);
  await database().db.transaction(async (tx) => {
    await admitted(tx, actor, "notes:write");
    await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, actor.id))
      .for("update");
    await receipt(tx, actor, { ...input, kind: "notes_settings" }, async () => {
      const [row] = await tx
        .select()
        .from(notesSettings)
        .where(eq(notesSettings.userId, actor.id));
      if ((row?.version ?? 0) !== input.version)
        fail(
          "conflict",
          "Your Notes preferences changed. Load the latest preferences.",
          409,
        );
      const values = { version: input.version + 1, settings: input.settings };
      await tx
        .insert(notesSettings)
        .values({ ...values, userId: actor.id })
        .onConflictDoUpdate({ target: notesSettings.userId, set: values });
      return { id: actor.id };
    });
  });
  return getNotesSettings(actor);
}
export async function getNotesDashboard(actor: Actor) {
  const prefs = await getNotesSettings(actor);
  const result = await searchNotes(actor, {
    filter: prefs.settings.dashboard === "pinned" ? "pinned" : "all",
    limit: prefs.settings.dashboardLimit,
  });
  return {
    userId: actor.id,
    notes: result.notes.map(
      ({ id, title, mode, theme, pinned, updatedAt }) => ({
        id,
        title,
        mode,
        theme,
        pinned,
        updatedAt,
      }),
    ),
  };
}
export async function uploadNoteImage(actor: Actor, data: unknown) {
  const input = noteImageSchema.parse(data);
  const initial = await access(database().db, actor, input.noteId);
  requireScope(actor, "notes:write");
  editor(initial.role);
  active(initial.row);
  if (!imageStorageConfigured())
    fail(
      "images_unavailable",
      "Private image storage is unavailable. Your note is safe.",
      503,
    );
  const image = await normalizeTaskImage(decodeTaskImage(input.imageBase64));
  const result = await database().db.transaction(async (tx) => {
    const { row, role } = await access(tx, actor, input.noteId, true);
    requireScope(actor, "notes:write");
    editor(role);
    active(row);
    return receipt(tx, actor, { ...input, kind: "note_image" }, async () => {
      version(row, input.version);
      const assets = await tx
        .select({ id: noteAssets.id })
        .from(noteAssets)
        .where(eq(noteAssets.noteId, row.id));
      if (assets.length >= 24)
        fail(
          "limit_reached",
          "A note can keep up to 24 private images. Reuse an uploaded image.",
        );
      const id = randomUUID();
      await tx.insert(noteAssets).values({
        id,
        noteId: row.id,
        uploaderId: actor.id,
        operationId: input.operationId,
        pathname: `wuff-note-images/${id}-${image.digest}.webp`,
        digest: image.digest,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
      });
      await bump(tx, row.id);
      return { id };
    });
  });
  const [asset] = await database()
    .db.select()
    .from(noteAssets)
    .where(
      and(eq(noteAssets.id, result.id), eq(noteAssets.noteId, input.noteId)),
    );
  if (!asset) fail("not_found", "Image not found.", 404);
  await storeTaskImage(asset.pathname, image.data);
  await database().db.transaction(async (tx) => {
    const { row, role } = await access(tx, actor, input.noteId, true);
    editor(role);
    active(row);
    requireScope(actor, "notes:write");
    await tx
      .update(noteAssets)
      .set({ ready: true })
      .where(eq(noteAssets.id, asset.id));
  });
  return {
    image: {
      id: asset.id,
      path: noteImagePath(asset.id),
      width: asset.width,
      height: asset.height,
    },
    note: await getNote(actor, input.noteId),
  };
}
export async function readNoteImage(actor: Actor, id: string) {
  const db = database().db;
  await admitted(db, actor);
  const [asset] = await db
    .select()
    .from(noteAssets)
    .where(and(eq(noteAssets.id, id), eq(noteAssets.ready, true)));
  if (!asset) fail("not_found", "Image not found.", 404);
  const { row } = await access(db, actor, asset.noteId);
  active(row);
  return {
    stream: await loadTaskImage(asset.pathname),
    image: {
      id: asset.id,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
    },
  };
}
export async function createNoteTask(
  actor: Actor,
  data: unknown,
  origin = process.env.WUFF_ORIGIN ?? "https://wuff-todo.vercel.app",
) {
  const input = noteTaskSchema.parse(data);
  requireScope(actor, "tasks:write");
  requireScope(actor, "lists:read");
  const result = await database().db.transaction(async (tx) => {
    const { row } = await access(tx, actor, input.noteId, true);
    active(row);
    return receipt(tx, actor, { ...input, kind: "note_task" }, async () => {
      version(row, input.version);
      const task = await createTaskInTransaction(tx, actor, {
        listId: input.listId,
        version: input.listVersion,
        operationId: input.operationId,
        title: input.title,
        content: noteTaskContent(
          row.id,
          row.content,
          input.includeContent,
          origin,
        ),
      });
      await tx
        .insert(noteTasks)
        .values({ noteId: row.id, taskId: task.taskId, creatorId: actor.id });
      await bump(tx, row.id);
      return { id: task.taskId };
    });
  });
  const { task } = await getTask(actor, result.id);
  return {
    note: await getNote(actor, input.noteId),
    task: {
      id: task.id,
      title: task.title,
      path: `/tasks/${task.id}`,
      listId: input.listId,
    },
  };
}

export async function readNoteImageBase64(actor: Actor, input: unknown) {
  const { assetId } = (await import("zod")).z
    .object({ assetId: (await import("@wuff/contracts")).idSchema })
    .strict()
    .parse(input);
  const { stream, image } = await readNoteImage(actor, assetId);
  return {
    image,
    imageBase64: Buffer.from(await new Response(stream).arrayBuffer()).toString(
      "base64",
    ),
  };
}
