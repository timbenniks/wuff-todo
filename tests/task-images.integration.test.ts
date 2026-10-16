import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, attachments, members } from "@wuff/db";
import { and, eq, inArray } from "drizzle-orm";
import { scopes, taskImagePath } from "@wuff/contracts";
import {
  createList,
  createTask,
  getList,
  deleteList,
  updateTask,
  updateList,
  uploadTaskImage,
  readTaskImage,
  removeListMember,
  cleanupTaskImages,
  deleteTask,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error("Isolated development only");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const a = { id: fixtures[0].id, scopes },
  b = { id: fixtures[1].id, scopes };
const imageBytes = await readFile("apps/web/public/mascot/waffles-icon.webp");
const write = (list: { id: string; version: number }) => ({
  listId: list.id,
  version: list.version,
  operationId: crypto.randomUUID(),
});
after(async () => database().pool.end());
test("private Blob images preserve draft isolation, current membership, task binding, retry/concurrency and cleanup", async () => {
  let list = await createList(a, {
    title: "Synthetic private images",
    operationId: crypto.randomUUID(),
  });
  const ids: string[] = [];
  const db = database().db;
  try {
    list = await createTask(a, { ...write(list), title: "Image notes" });
    const taskId = list.tasks[0].id;
    const request = { ...write(list), taskId };
    const [image, retry] = await Promise.all([
      uploadTaskImage(a, request, imageBytes),
      uploadTaskImage(a, request, imageBytes),
    ]);
    ids.push(image.id);
    assert.equal(image.id, retry.id);
    assert.equal(
      (await getList(a, list.id)).version,
      list.version,
      "Draft upload must not advance the saved list",
    );
    assert.equal((await getList(a, list.id)).tasks[0].content, "");
    assert.equal((await getList(a, list.id)).tasks[0].images.length, 0);
    assert.ok(
      (
        await new Response(
          (await readTaskImage(a, image.id)).stream,
        ).arrayBuffer()
      ).byteLength > 0,
    );
    await assert.rejects(readTaskImage(b, image.id), { code: "not_found" });
    await assert.rejects(
      uploadTaskImage({ ...a, scopes: ["lists:read"] }, request, imageBytes),
      { code: "forbidden" },
    );
    await assert.rejects(
      uploadTaskImage(a, request, Buffer.from("Not an image")),
      { code: "invalid_image" },
    );
    const otherBytes = await readFile("apps/web/public/icons/app-180.png");
    await assert.rejects(uploadTaskImage(a, request, otherBytes), {
      code: "idempotency_conflict",
    });
    await db.insert(members).values({ listId: list.id, userId: b.id });
    await assert.rejects(
      readTaskImage(b, image.id),
      { code: "not_found" },
      "A shared member cannot read another person's unsaved image",
    );
    list = await updateTask(a, {
      ...write(list),
      taskId,
      content: image.markdown,
    });
    assert.equal(list.tasks[0].images[0].id, image.id);
    assert.ok(
      (
        await new Response(
          (await readTaskImage(b, image.id)).stream,
        ).arrayBuffer()
      ).byteLength > 0,
    );
    await assert.rejects(
      uploadTaskImage(
        a,
        { ...request, operationId: crypto.randomUUID() },
        imageBytes,
      ),
      { code: "conflict" },
    );
    assert.equal(
      (await uploadTaskImage(a, request, imageBytes)).id,
      image.id,
      "Identical retry survives later list versions",
    );
    list = await createTask(a, { ...write(list), title: "Other task" });
    const otherTask = list.tasks.find((task) => task.id !== taskId)!;
    await assert.rejects(
      updateTask(a, {
        ...write(list),
        taskId: otherTask.id,
        content: image.markdown,
      }),
      { code: "invalid_attachment" },
    );
    const draftRequest = { ...write(list), taskId };
    const draftImage = await uploadTaskImage(b, draftRequest, imageBytes);
    ids.push(draftImage.id);
    await assert.rejects(readTaskImage(a, draftImage.id), {
      code: "not_found",
    });
    list = await updateTask(b, {
      ...write(list),
      taskId,
      content: `${image.markdown}\n\n${draftImage.markdown}`,
    });
    assert.ok(
      (
        await new Response(
          (await readTaskImage(a, draftImage.id)).stream,
        ).arrayBuffer()
      ).byteLength > 0,
    );
    list = await updateList(a, { ...write(list), archived: true });
    assert.ok(await readTaskImage(b, image.id));
    await assert.rejects(
      uploadTaskImage(a, { ...write(list), taskId }, imageBytes),
      { code: "list_archived" },
    );
    list = await updateList(a, { ...write(list), archived: false });
    list = await removeListMember(a, { ...write(list), userId: b.id }).then(
      () => getList(a, list.id),
    );
    await assert.rejects(readTaskImage(b, image.id), { code: "not_found" });
    await assert.rejects(uploadTaskImage(b, draftRequest, imageBytes), {
      code: "not_found",
    });
    const raceWrite = { ...write(list), taskId, content: image.markdown };
    const races = await Promise.allSettled([
      updateTask(a, raceWrite),
      updateTask(a, {
        ...raceWrite,
        operationId: crypto.randomUUID(),
        content: `${image.markdown}\n\nMore de-tails`,
      }),
    ]);
    assert.equal(
      races.filter((result) => result.status === "fulfilled").length,
      1,
    );
    list = await getList(a, list.id);
    await assert.rejects(
      readTaskImage(a, draftImage.id),
      { code: "not_found" },
      "Removed images stop being readable before physical cleanup",
    );
    const expired = await uploadTaskImage(
      a,
      { ...write(list), taskId },
      imageBytes,
    );
    ids.push(expired.id);
    await db
      .update(attachments)
      .set({ createdAt: new Date(Date.now() - 90_000_000) })
      .where(eq(attachments.id, expired.id));
    await assert.rejects(readTaskImage(a, expired.id), { code: "not_found" });
    await assert.rejects(
      updateTask(a, { ...write(list), taskId, content: expired.markdown }),
      { code: "invalid_attachment" },
    );
    list = await deleteTask(a, { ...write(list), taskId });
    await assert.rejects(readTaskImage(a, image.id), { code: "not_found" });
    const dangling = await db
      .select()
      .from(attachments)
      .where(inArray(attachments.id, ids));
    assert.equal(dangling.length, ids.length);
    assert.ok(dangling.every((row) => row.taskId === null));
    await db
      .update(attachments)
      .set({ createdAt: new Date(Date.now() - 90_000_000) })
      .where(inArray(attachments.id, ids));
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    try {
      process.env.BLOB_READ_WRITE_TOKEN = "invalid";
      const failed = await cleanupTaskImages();
      assert.ok(failed.failed >= ids.length);
    } finally {
      process.env.BLOB_READ_WRITE_TOKEN = token;
    }
    await db
      .update(attachments)
      .set({ retiredAt: new Date(Date.now() - 7_200_000) })
      .where(inArray(attachments.id, ids));
    const cleaned = await cleanupTaskImages();
    assert.ok(cleaned.removed >= ids.length);
    assert.equal(
      (
        await db
          .select({ id: attachments.id })
          .from(attachments)
          .where(inArray(attachments.id, ids))
      ).length,
      0,
    );
    assert.equal((await cleanupTaskImages()).failed, 0);
  } finally {
    await deleteList(a, write(await getList(a, list.id)));
    if (ids.length) {
      await db
        .update(attachments)
        .set({
          createdAt: new Date(Date.now() - 90_000_000),
          retiredAt: new Date(Date.now() - 7_200_000),
        })
        .where(inArray(attachments.id, ids));
      await cleanupTaskImages();
    }
  }
});

test("HTTP and authenticated MCP upload/read the same private images without exposing Blob credentials", async () => {
  const { loginFixture } = await import("./helpers/login");
  const { createHash, randomBytes } = await import("node:crypto");
  const origin = "http://localhost:3000",
    resource = `${origin}/api/mcp`;
  const cookie = await loginFixture(fixtures[0]),
    editorCookie = await loginFixture(fixtures[1]);
  const clientIds: string[] = [],
    ids: string[] = [];
  const json = {
    Origin: origin,
    "Content-Type": "application/json",
    Cookie: cookie,
  };
  async function grant(scope: string) {
    const client = await (
      await fetch(`${origin}/oauth/register`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          client_name: "Private image integration",
          redirect_uris: ["http://127.0.0.1:4199/callback"],
        }),
      })
    ).json();
    clientIds.push(client.client_id);
    const verifier = randomBytes(32).toString("base64url");
    const query = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: client.redirect_uris[0],
      response_type: "code",
      scope,
      state: randomBytes(24).toString("hex"),
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      resource,
    });
    let decision: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      decision = await fetch(`${origin}/oauth/authorize/decision`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ query: query.toString(), accept: true }),
      });
      if (decision.status !== 429 || attempt === 3) break;
      const delay = Math.min(
        30,
        Math.max(5, Number(decision.headers.get("Retry-After")) || 15),
      );
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
    assert.equal(
      decision!.status,
      200,
      "Synthetic OAuth consent succeeds after bounded auth throttling retries",
    );
    const consent = await decision!.json();
    const code = new URL(consent.redirect).searchParams.get("code")!;
    const token = await (
      await fetch(`${origin}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: client.client_id,
          code,
          code_verifier: verifier,
          redirect_uri: client.redirect_uris[0],
          resource,
        }),
      })
    ).json();
    assert.equal(typeof token.access_token, "string");
    return token.access_token as string;
  }
  let rpcId = 0;
  async function rpc(
    token: string,
    name: string,
    args: Record<string, unknown>,
  ) {
    const response = await fetch(resource, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpcId,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).result;
  }
  let list = await createList(a, {
    title: "Synthetic image adapters",
    operationId: crypto.randomUUID(),
  });
  try {
    const token = await grant(scopes.join(" "));
    const readToken = await grant("lists:read");
    list = await createTask(a, { ...write(list), title: "Shared image notes" });
    const taskId = list.tasks[0].id;
    const uploadInput = {
      ...write(list),
      taskId,
      imageBase64: imageBytes.toString("base64"),
    };
    assert.ok((await rpc(readToken, "upload_task_image", uploadInput)).isError);
    const uploaded = await rpc(token, "upload_task_image", uploadInput);
    assert.ok(!uploaded.isError);
    const image = uploaded.structuredContent.image;
    ids.push(image.id);
    assert.equal(
      (await rpc(token, "upload_task_image", uploadInput)).structuredContent
        .image.id,
      image.id,
    );
    const path = taskImagePath(image.id);
    assert.equal((await fetch(origin + path)).status, 401);
    assert.equal(
      (await fetch(origin + path, { headers: { Cookie: editorCookie } }))
        .status,
      404,
    );
    const saved = await fetch(`${origin}/api/v1/tasks`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ ...write(list), taskId, content: image.markdown }),
    });
    assert.equal(saved.status, 200);
    list = await saved.json();
    const read = await rpc(readToken, "get_task_image", {
      attachmentId: image.id,
    });
    assert.ok(!read.isError);
    assert.ok(
      read.content.some(
        (item: { type: string; mimeType?: string }) =>
          item.type === "image" && item.mimeType === "image/webp",
      ),
    );
    assert.ok(
      !JSON.stringify(read.structuredContent).includes(
        "blob.vercel-storage.com",
      ),
    );
    await database()
      .db.insert(members)
      .values({ listId: list.id, userId: b.id });
    const web = await fetch(origin + path, {
      headers: { Cookie: editorCookie },
    });
    assert.equal(web.status, 200);
    assert.equal(web.headers.get("content-type"), "image/webp");
    assert.match(web.headers.get("cache-control")!, /no-store/);
    assert.equal(web.headers.get("location"), null);
    const query = new URLSearchParams(
      Object.entries({ ...write(list), taskId }).map(([key, value]) => [
        key,
        String(value),
      ]),
    );
    const uploadWeb = () =>
      fetch(`${origin}/api/v1/attachments?${query}`, {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "image/webp",
        },
        body: imageBytes,
      });
    assert.equal(
      (
        await fetch(`${origin}/api/v1/attachments?${query}`, {
          method: "POST",
          headers: { Cookie: cookie },
          body: imageBytes,
        })
      ).status,
      403,
    );
    const webImageResponse = await uploadWeb();
    assert.equal(webImageResponse.status, 200);
    const webImage = (await webImageResponse.json()).image;
    ids.push(webImage.id);
    assert.equal((await (await uploadWeb()).json()).image.id, webImage.id);
    const updated = await rpc(token, "update_task", {
      ...write(list),
      taskId,
      content: `${image.markdown}\n\n${webImage.markdown}`,
    });
    assert.ok(!updated.isError);
    list = updated.structuredContent.list;
    assert.equal(list.tasks[0].images.length, 2);
    await removeListMember(a, { ...write(list), userId: b.id });
    list = await getList(a, list.id);
    assert.equal(
      (await fetch(origin + path, { headers: { Cookie: editorCookie } }))
        .status,
      404,
    );
    assert.equal(
      (await fetch(`${origin}/api/internal/task-images`)).status,
      401,
    );
  } finally {
    await deleteList(a, write(await getList(a, list.id)));
    if (ids.length) {
      await database()
        .db.update(attachments)
        .set({
          createdAt: new Date(Date.now() - 90_000_000),
          retiredAt: new Date(Date.now() - 7_200_000),
        })
        .where(inArray(attachments.id, ids));
      await cleanupTaskImages();
    }
    for (const clientId of clientIds)
      await fetch(`${origin}/api/v1/connections`, {
        method: "DELETE",
        headers: json,
        body: JSON.stringify({ clientId }),
      });
  }
});
