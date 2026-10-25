import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  database,
  notes,
  noteAssets,
  notePreferences,
  notesSettings,
  receipts,
  oauthTokens,
  users,
} from "@wuff/db";
import {
  scopes,
  type Actor,
  type NoteDetail,
  type NoteMutation,
  notePath,
} from "@wuff/contracts";
import {
  createNote,
  getNote,
  searchNotes,
  updateNote,
  updateNotesSettings,
  getNotesSettings,
  getNotesDashboard,
  createNoteTask,
  uploadNoteImage,
  readNoteImage,
  createList,
  getList,
  deleteList,
} from "@wuff/domain";
import { eraseTaskImage } from "../packages/domain/src/platform/image-storage";
import { loginFixture } from "./helpers/login";
import {
  empireGrant,
  empireMcp,
  fixtureOrigin as origin,
} from "./helpers/empire-grant";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(
    new URL("../packages/domain/package.json", import.meta.url),
  ),
  sharp = require("sharp");
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const [first, second] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const a: Actor = { id: first.id, scopes },
  b: Actor = { id: second.id, scopes };
after(() => database().pool.end());
test("Notes domain enforces private/sharing/link/board boundaries, personal state, concurrency and atomic Todo export", async () => {
  const db = database().db,
    ids: string[] = [],
    operations: string[] = [],
    prefix = `Notes domain ${crypto.randomUUID()}`,
    op = () => {
      const id = crypto.randomUUID();
      operations.push(id);
      return id;
    };
  const [settingsBefore] = await db
    .select()
    .from(notesSettings)
    .where(eq(notesSettings.userId, a.id));
  let listId: string | undefined;
  const create = async (actor: Actor, title: string) => {
    const n = await createNote(actor, {
      title: `${prefix} ${title}`,
      operationId: op(),
    });
    ids.push(n.id);
    return n;
  };
  const change = async (
    actor: Actor,
    n: NoteDetail,
    c: NoteMutation["change"],
  ) =>
    updateNote(actor, {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      change: c,
    }) as Promise<NoteDetail>;
  try {
    let n = await create(a, "Shared canvas"),
      privateTarget = await create(a, "Private linked title"),
      other = await create(b, "Other owner");
    await assert.rejects(() => getNote(b, n.id), { code: "not_found" });
    assert(
      !(await searchNotes(b, { search: prefix })).notes.some(
        (row) => row.id === n.id,
      ),
    );
    n = await change(a, n, {
      action: "save",
      title: n.title,
      content: "# Rich note\n\nA **bold** idea",
      tags: ["Home", "home"],
      mode: "moodboard",
      theme: "sage",
    });
    assert.deepEqual(n.tags, ["home"]);
    n = await change(a, n, { action: "link", targetId: privateTarget.id });
    n = await change(a, n, {
      action: "add_card",
      body: { kind: "note", targetId: privateTarget.id },
    });
    await assert.rejects(
      () => change(a, n, { action: "link", targetId: n.id }),
      { code: "invalid_link" },
    );
    await assert.rejects(
      () => change(a, n, { action: "link", targetId: other.id }),
      { code: "not_found" },
    );
    n = await change(a, n, {
      action: "share",
      email: second.email,
      role: "viewer",
    });
    let view = await getNote(b, n.id);
    assert.equal(view.role, "viewer");
    assert.equal(view.canEdit, false);
    assert(!JSON.stringify(view).includes(privateTarget.id));
    assert(!JSON.stringify(view).includes(privateTarget.title));
    assert.equal(view.links.length, 0);
    assert.equal(view.cards[0].body.kind, "note");
    await assert.rejects(
      () =>
        change(b, view, {
          action: "save",
          title: "Forbidden",
          content: "",
          tags: [],
          mode: "note",
          theme: "blue",
        }),
      { code: "forbidden" },
    );
    await assert.rejects(
      () =>
        change(b, view, {
          action: "share",
          email: first.email,
          role: "editor",
        }),
      { code: "owner_required" },
    );
    const pref = {
      noteId: n.id,
      version: view.version,
      operationId: op(),
      change: {
        action: "preference",
        preferenceVersion: 0,
        pinned: true,
        archived: true,
      },
    };
    const pinned = (await updateNote(b, pref)) as NoteDetail;
    assert(pinned.archived);
    assert(pinned.pinned);
    assert(!(await getNote(a, n.id)).archived);
    assert(
      !(await searchNotes(b, { search: prefix })).notes.some(
        (row) => row.id === n.id,
      ),
    );
    assert(
      (await searchNotes(b, { filter: "archived" })).notes.some(
        (row) => row.id === n.id,
      ),
    );
    await updateNote(b, pref);
    await assert.rejects(
      () =>
        updateNote(b, { ...pref, change: { ...pref.change, pinned: false } }),
      { code: "idempotency_conflict" },
    );
    n = await change(a, n, {
      action: "share",
      email: second.email,
      role: "editor",
    });
    view = await getNote(b, n.id);
    view = await change(b, view, {
      action: "add_card",
      body: { kind: "text", title: "A card", text: "Card search token" },
    });
    n = await getNote(a, n.id);
    assert(
      (await searchNotes(a, { search: "Card search token" })).notes.some(
        (row) => row.id === n.id,
      ),
    );
    const race = await Promise.allSettled([
      change(a, n, {
        action: "add_card",
        body: { kind: "text", title: "One", text: "1" },
      }),
      change(b, n, {
        action: "add_card",
        body: { kind: "text", title: "Two", text: "2" },
      }),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert(
      (race.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.code === "conflict",
    );
    n = await getNote(a, n.id);
    const order = n.cards.map((c) => c.id).reverse();
    n = await change(a, n, { action: "reorder_cards", cardIds: order });
    assert.deepEqual(
      n.cards.map((c) => c.id),
      order,
    );
    await assert.rejects(
      () => change(a, n, { action: "reorder_cards", cardIds: [] }),
      { code: "invalid_order" },
    );
    const originalCards = n.cards.length;
    n = await change(a, n, {
      action: "save",
      title: n.title,
      content: n.content,
      tags: n.tags,
      mode: "note",
      theme: "rose",
    });
    assert.equal(n.cards.length, originalCards);
    n = await change(a, n, {
      action: "save",
      title: n.title,
      content: n.content,
      tags: n.tags,
      mode: "moodboard",
      theme: "sand",
    });
    await change(a, privateTarget, {
      action: "share",
      email: second.email,
      role: "viewer",
    });
    assert(
      (await getNote(b, n.id)).links.some((ref) => ref.id === privateTarget.id),
    );
    assert(
      (await getNote(b, privateTarget.id)).backlinks.some(
        (ref) => ref.id === n.id,
      ),
    );
    const settings = await getNotesSettings(a);
    await updateNotesSettings(a, {
      version: settings.version,
      operationId: op(),
      settings: {
        defaultMode: "moodboard",
        defaultTheme: "lavender",
        dashboard: "recent",
        dashboardLimit: 2,
      },
    });
    const defaults = await create(a, "Defaults");
    assert.equal(defaults.mode, "moodboard");
    assert.equal(defaults.theme, "lavender");
    assert((await getNotesDashboard(a)).notes.length <= 2);
    let list = await createList(a, {
      title: `${prefix} Todo`,
      operationId: op(),
    });
    listId = list.id;
    const exported = {
      noteId: n.id,
      version: n.version,
      listId: list.id,
      listVersion: list.version,
      title: "Task from note",
      includeContent: true,
      confirmed: true,
      operationId: op(),
    };
    const task = await createNoteTask(a, exported, origin);
    assert.equal(task.note.tasks.length, 1);
    const reread = await getList(a, list.id);
    assert.equal(reread.tasks.length, 1);
    assert(reread.tasks[0].content.includes(notePath(n.id)));
    assert(reread.tasks[0].content.includes("bold"));
    assert.deepEqual(
      (await createNoteTask(a, exported, origin)).task,
      task.task,
    );
    await assert.rejects(
      () => createNoteTask(a, { ...exported, title: "changed" }, origin),
      { code: "idempotency_conflict" },
    );
    n = await getNote(a, n.id);
    const before = n.version;
    await assert.rejects(
      () =>
        createNoteTask(
          a,
          {
            ...exported,
            operationId: op(),
            version: n.version,
            listVersion: 0,
          },
          origin,
        ),
      { code: "conflict" },
    );
    assert.equal((await getNote(a, n.id)).version, before);
    assert.equal((await getList(a, list.id)).tasks.length, 1);
    n = await change(a, n, { action: "unshare", userId: b.id });
    await assert.rejects(() => getNote(b, n.id), { code: "not_found" });
    await assert.rejects(() => updateNote(b, pref), { code: "not_found" });
    n = await change(a, n, { action: "trash" });
    assert(n.trashed);
    await assert.rejects(
      () =>
        change(a, n, {
          action: "add_card",
          body: { kind: "text", title: "", text: "no" },
        }),
      { code: "note_trashed" },
    );
    n = await change(a, n, { action: "restore" });
    assert(!n.trashed);
    const image = await sharp({
      create: { width: 12, height: 8, channels: 3, background: "#6e8574" },
    })
      .png()
      .toBuffer();
    const imageInput = {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      imageBase64: image.toString("base64"),
    };
    const uploaded = await uploadNoteImage(a, imageInput);
    assert.equal(uploaded.image.width, 12);
    assert.equal(
      (await uploadNoteImage(a, imageInput)).image.id,
      uploaded.image.id,
    );
    const bytes = Buffer.from(
      await new Response(
        (await readNoteImage(a, uploaded.image.id)).stream,
      ).arrayBuffer(),
    );
    assert.equal((await sharp(bytes).metadata()).format, "webp");
    await assert.rejects(() => readNoteImage(b, uploaded.image.id), {
      code: "not_found",
    });
    n = uploaded.note;
    n = await change(a, n, {
      action: "add_card",
      body: {
        kind: "image",
        assetId: uploaded.image.id,
        caption: "A private palette",
      },
    });
    assert(n.cards.some((c) => c.imagePath === uploaded.image.path));
    await assert.rejects(
      () =>
        uploadNoteImage(
          { ...a, scopes: ["notes:read"] },
          { ...imageInput, operationId: op(), imageBase64: "bad!" },
        ),
      { code: "forbidden" },
    );
  } finally {
    const rows = ids.length
      ? await db
          .select()
          .from(noteAssets)
          .where(inArray(noteAssets.noteId, ids))
      : [];
    for (const row of rows) await eraseTaskImage(row.pathname);
    if (listId) {
      const list = await getList(a, listId);
      await deleteList(a, { listId, version: list.version, operationId: op() });
    }
    if (ids.length) await db.delete(notes).where(inArray(notes.id, ids));
    await db.delete(notesSettings).where(eq(notesSettings.userId, a.id));
    if (settingsBefore) await db.insert(notesSettings).values(settingsBefore);
    if (operations.length)
      await db
        .delete(receipts)
        .where(
          and(
            inArray(receipts.actorId, [a.id, b.id]),
            inArray(receipts.operationId, operations),
          ),
        );
  }
});

test("Notes HTTP, MCP and native adapters preserve consent, mutations, images, account pinning and revocation", async () => {
  const db = database().db,
    ids: string[] = [],
    operations: string[] = [],
    tokens: Awaited<ReturnType<typeof empireGrant>>[] = [],
    op = () => {
      const id = crypto.randomUUID();
      operations.push(id);
      return id;
    };
  const cookie = await loginFixture(first),
    otherCookie = await loginFixture(second),
    headers = {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
      "X-Wuff-User": first.id,
    };
  const grant = async (scope: string, native = false) => {
    const token = await empireGrant(cookie, scope, native);
    tokens.push(token);
    return token;
  };
  const api = async (
    path: string,
    method = "GET",
    input?: unknown,
    h: Record<string, string> = headers,
  ) =>
    fetch(origin + "/api/v1/notes" + path, {
      method,
      headers: h,
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
  const mcp = await grant(
      "notes:read notes:write notes:manage lists:read tasks:write",
    ),
    readonly = await grant("notes:read"),
    legacy = await grant("lists:read"),
    native = await grant(
      "lists:read tasks:write notes:read notes:write notes:manage",
      true,
    );
  const invoke = async (name: string, input: unknown = {}) => {
    const r = await empireMcp(mcp.access_token, name, input);
    assert.equal(r.status, 200);
    assert(!r.result?.isError, JSON.stringify(r.result));
    return r.result.structuredContent;
  };
  const nativeCall = async (
    action: string,
    input: unknown,
    userId = first.id,
  ) =>
    fetch(origin + "/api/mobile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${native.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, input, userId }),
    });
  const [settingsBefore] = await db
    .select()
    .from(notesSettings)
    .where(eq(notesSettings.userId, a.id));
  let listId: string | undefined;
  try {
    assert.equal((await fetch(origin + "/api/v1/notes")).status, 401);
    assert.equal(
      (
        await api("", "GET", undefined, {
          ...headers,
          "X-Wuff-User": second.id,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          "",
          "POST",
          { title: "blocked", operationId: op() },
          { ...headers, Origin: "https://example.invalid" },
        )
      ).status,
      403,
    );
    let response = await api("", "POST", {
      title: "Adapter note",
      mode: "moodboard",
      operationId: op(),
    });
    assert.equal(response.status, 200);
    let n: NoteDetail = await response.json();
    ids.push(n.id);
    assert.deepEqual((await invoke("get_note", { noteId: n.id })).note, n);
    assert.equal(
      (await api("/" + n.id, "GET", undefined, { Cookie: otherCookie })).status,
      404,
    );
    const save = {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      change: {
        action: "save",
        title: "Adapter rich content",
        content: "**Hello** from MCP",
        tags: ["Mcp"],
        mode: "moodboard",
        theme: "peach",
      },
    };
    n = (await invoke("update_note", save)).note;
    assert.deepEqual(await (await api("/" + n.id)).json(), n);
    assert.deepEqual((await invoke("update_note", save)).note, n);
    const mutation = async (
      change: NoteMutation["change"],
      tool = "update_note",
    ) => {
      const input = {
        noteId: n.id,
        version: n.version,
        operationId: op(),
        change,
      };
      n = (await invoke(tool, input)).note;
      assert.deepEqual(await (await api("/" + n.id)).json(), n);
      // The HTTP adapter accepts the identical committed write and MCP reads it back.
      const replay = await api("/" + n.id, "PUT", input);
      assert.equal(replay.status, 200);
      assert.deepEqual(await replay.json(), n);
      assert.deepEqual((await invoke("get_note", { noteId: n.id })).note, n);
      return n;
    };
    await mutation({
      action: "add_card",
      body: { kind: "text", title: "Initial", text: "Text" },
    });
    const card = n.cards[0];
    await mutation({
      action: "update_card",
      cardId: card.id,
      body: { kind: "text", title: "Changed", text: "Edited" },
    });
    assert.equal(
      (await (await api("/" + n.id)).json()).cards[0].body.title,
      "Changed",
    );
    await mutation({
      action: "add_card",
      body: { kind: "link", title: "Example", url: "https://example.com" },
    });
    await mutation({
      action: "reorder_cards",
      cardIds: n.cards.map((c) => c.id).reverse(),
    });
    await mutation({ action: "remove_card", cardId: card.id });
    const linked = (
      await invoke("create_note", {
        title: "Linked adapter note",
        operationId: op(),
      })
    ).note;
    ids.push(linked.id);
    await mutation({ action: "link", targetId: linked.id });
    assert(
      (await (await api("/" + linked.id)).json()).backlinks.some(
        (r: { id: string }) => r.id === n.id,
      ),
    );
    await mutation({ action: "unlink", targetId: linked.id });
    await mutation({
      action: "preference",
      preferenceVersion: n.preferenceVersion,
      pinned: true,
      archived: false,
    });
    assert(
      (await (await api("/dashboard")).json()).notes.some(
        (r: { id: string }) => r.id === n.id,
      ),
    );
    assert.deepEqual(
      (await invoke("get_notes_dashboard")).notesDashboard,
      await (await api("/dashboard")).json(),
    );
    await mutation(
      { action: "share", email: second.email, role: "viewer" },
      "manage_note",
    );
    assert.equal(
      (await api("/" + n.id, "GET", undefined, { Cookie: otherCookie })).status,
      200,
    );
    await mutation({ action: "unshare", userId: second.id }, "manage_note");
    assert.equal(
      (await api("/" + n.id, "GET", undefined, { Cookie: otherCookie })).status,
      404,
    );
    const editBypass = await empireMcp(mcp.access_token, "update_note", {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      change: { action: "trash" },
    });
    assert(editBypass.result?.isError || editBypass.error);
    const denied = await empireMcp(readonly.access_token, "update_note", save);
    assert(denied.result?.isError);
    assert(JSON.stringify(denied.result).includes("disabled"));
    assert(
      (await empireMcp(legacy.access_token, "get_note", { noteId: n.id }))
        .result?.isError,
    );
    const refresh = await fetch(origin + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: legacy.clientId,
        refresh_token: legacy.refresh_token,
        resource: legacy.resource,
      }),
    });
    assert.equal(refresh.status, 200);
    assert(!(await refresh.json()).scope.includes("notes:"));
    const settings = await (await api("/settings")).json(),
      updated = (
        await invoke("update_notes_settings", {
          version: settings.version,
          settings: { ...settings.settings, defaultTheme: "sage" },
          operationId: op(),
        })
      ).notesSettings;
    assert.deepEqual(await (await api("/settings")).json(), updated);
    assert.deepEqual(
      (await invoke("get_notes_settings")).notesSettings,
      updated,
    );
    const apiSettingsInput = {
      version: updated.version,
      settings: updated.settings,
      operationId: op(),
    };
    const apiSettings = await api("/settings", "PUT", apiSettingsInput);
    assert.equal(apiSettings.status, 200);
    assert.deepEqual(
      (await invoke("get_notes_settings")).notesSettings,
      await apiSettings.json(),
    );
    const nativeInput = {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      change: {
        action: "save",
        title: "Native changed title",
        content: n.content,
        tags: n.tags,
        mode: n.mode,
        theme: n.theme,
      },
    };
    response = await nativeCall("updateNote", nativeInput);
    assert.equal(response.status, 200);
    n = await response.json();
    assert.deepEqual((await invoke("get_note", { noteId: n.id })).note, n);
    assert.equal((await nativeCall("getNote", n.id, second.id)).status, 409);
    assert.equal((await nativeCall("getNote", n.id)).status, 200);
    const image = await sharp({
        create: { width: 16, height: 10, channels: 3, background: "#bca17d" },
      })
        .png()
        .toBuffer(),
      imageInput = {
        noteId: n.id,
        version: n.version,
        operationId: op(),
        imageBase64: image.toString("base64"),
      };
    response = await api("/images", "POST", imageInput);
    assert.equal(response.status, 200);
    const uploaded = await response.json();
    n = uploaded.note;
    const imageMcp = await empireMcp(mcp.access_token, "get_note_image", {
      assetId: uploaded.image.id,
    });
    assert(!imageMcp.result.isError);
    assert.equal(imageMcp.result.content[0].type, "image");
    response = await api("/images/" + uploaded.image.id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(
      Buffer.from(await response.arrayBuffer()).toString("base64"),
      imageMcp.result.content[0].data,
    );
    assert.equal(
      (
        await api("/images/" + uploaded.image.id, "GET", undefined, {
          Cookie: otherCookie,
        })
      ).status,
      404,
    );
    const nativeImage = await nativeCall("getNoteImage", {
      assetId: uploaded.image.id,
    });
    assert.equal(nativeImage.status, 200);
    assert.equal(
      (await nativeImage.json()).imageBase64,
      imageMcp.result.content[0].data,
    );
    response = await fetch(origin + "/api/v1/notes/images", {
      method: "POST",
      headers,
      body: "{",
    });
    assert.equal(response.status, 400);
    let list = await createList(a, {
      title: "Adapter export fixture",
      operationId: op(),
    });
    listId = list.id;
    const exported = {
      noteId: n.id,
      version: n.version,
      listId,
      listVersion: list.version,
      title: "From adapter note",
      confirmed: true,
      operationId: op(),
    };
    const task = await invoke("create_note_task", exported);
    n = task.note;
    assert.equal((await getList(a, listId)).tasks.length, 1);
    assert.deepEqual(await (await api("/export", "POST", exported)).json(), {
      note: task.note,
      task: task.task,
    });
    await mutation({ action: "trash" }, "manage_note");
    assert(
      (await (await api("?filter=trash")).json()).notes.some(
        (row: { id: string }) => row.id === n.id,
      ),
    );
    await mutation({ action: "restore" }, "manage_note");
    assert.equal(
      (await empireMcp("", "get_note", { noteId: n.id })).status,
      401,
    );
    await db
      .update(oauthTokens)
      .set({ accessExpiresAt: new Date(0) })
      .where(
        eq(
          oauthTokens.accessHash,
          createHash("sha256").update(readonly.access_token).digest("hex"),
        ),
      );
    assert.equal(
      (await empireMcp(readonly.access_token, "get_note", { noteId: n.id }))
        .status,
      401,
    );
    const revoke = await fetch(origin + "/oauth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: mcp.access_token,
        client_id: mcp.clientId,
      }),
    });
    assert.equal(revoke.status, 200);
    assert.equal(
      (await empireMcp(mcp.access_token, "update_note", save)).status,
      401,
    );
    assert.equal((await api("?offset=5001")).status, 400);
    const invalidPage = await fetch(origin + "/notes?note=invalid", {
      headers: { Cookie: cookie },
    });
    assert.equal(invalidPage.status, 200);
    assert((await invalidPage.text()).includes("Note unavailable"));
  } finally {
    for (const row of ids.length
      ? await db
          .select()
          .from(noteAssets)
          .where(inArray(noteAssets.noteId, ids))
      : [])
      await eraseTaskImage(row.pathname);
    if (listId) {
      const list = await getList(a, listId);
      await deleteList(a, { listId, version: list.version, operationId: op() });
    }
    if (ids.length) await db.delete(notes).where(inArray(notes.id, ids));
    await db.delete(notesSettings).where(eq(notesSettings.userId, a.id));
    if (settingsBefore) await db.insert(notesSettings).values(settingsBefore);
    if (operations.length)
      await db
        .delete(receipts)
        .where(
          and(
            eq(receipts.actorId, a.id),
            inArray(receipts.operationId, operations),
          ),
        );
    const dynamic = tokens.filter((t) => !t.native).map((t) => t.clientId);
    if (dynamic.length)
      await db
        .update(oauthTokens)
        .set({ revoked: true })
        .where(inArray(oauthTokens.clientId, dynamic));
    for (const token of tokens.filter((t) => t.native))
      await db
        .update(oauthTokens)
        .set({ revoked: true })
        .where(
          eq(
            oauthTokens.accessHash,
            createHash("sha256").update(token.access_token).digest("hex"),
          ),
        );
  }
});

test("Notes leave retries acknowledge only the actor's committed self-removal without recovering note access", async () => {
  const db = database().db,
    operations: string[] = [],
    op = () => {
      const id = crypto.randomUUID();
      operations.push(id);
      return id;
    };
  let noteId: string | undefined;
  try {
    let n = await createNote(a, {
      title: "Notes leave regression",
      operationId: op(),
    });
    noteId = n.id;
    n = (await updateNote(a, {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      change: { action: "share", email: second.email, role: "viewer" },
    })) as NoteDetail;
    const input = {
      noteId: n.id,
      version: n.version,
      operationId: op(),
      change: { action: "leave" },
    };
    const cookie = await loginFixture(second);
    const leaveRequest = () =>
      fetch(origin + "/api/v1/notes/" + n.id, {
        method: "PUT",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
          "X-Wuff-User": b.id,
        },
        body: JSON.stringify(input),
      });
    const firstReply = await leaveRequest();
    assert.equal(firstReply.status, 200);
    assert.deepEqual(await firstReply.json(), { left: true });
    const retriedReply = await leaveRequest();
    assert.equal(retriedReply.status, 200);
    assert.deepEqual(await retriedReply.json(), { left: true });
    assert.deepEqual(await updateNote(b, input), { left: true });
    assert.deepEqual(await updateNote(b, input), { left: true });
    await assert.rejects(() => getNote(b, n.id), { code: "not_found" });
    await assert.rejects(
      () => updateNote(b, { ...input, version: input.version + 1 }),
      { code: "idempotency_conflict" },
    );
    await assert.rejects(
      () => updateNote({ ...b, scopes: ["notes:read"] }, input),
      { code: "forbidden" },
    );
    await assert.rejects(() => updateNote(b, { ...input, operationId: op() }), {
      code: "not_found",
    });
    n = await getNote(a, n.id);
    assert.equal(n.members?.length, 0);
    await assert.rejects(
      () =>
        updateNote(a, {
          noteId: n.id,
          version: n.version,
          operationId: op(),
          change: { action: "leave" },
        }),
      { code: "owner_required" },
    );
  } finally {
    if (noteId) await db.delete(notes).where(eq(notes.id, noteId));
    if (operations.length)
      await db
        .delete(receipts)
        .where(
          and(
            inArray(receipts.actorId, [a.id, b.id]),
            inArray(receipts.operationId, operations),
          ),
        );
  }
});
