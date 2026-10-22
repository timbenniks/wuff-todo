// Synthetic development UI proof; never runs against production.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { and, eq } from "drizzle-orm";
import { database, members, reminderPreferences, reminderJobs } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import { createList, createTask, getList, deleteList } from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const origin = "http://localhost:3001";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const fixtures = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const actor = { id: fixtures[0].id, scopes };
const db = database().db;
const [oldPrefs] = await db
  .select()
  .from(reminderPreferences)
  .where(eq(reminderPreferences.userId, actor.id));
const [oldDigest] = await db
  .select()
  .from(reminderJobs)
  .where(
    and(eq(reminderJobs.userId, actor.id), eq(reminderJobs.kind, "digest")),
  );
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let list = await createList(actor, {
  title: "Synthetic reminder UX",
  operationId: crypto.randomUUID(),
});
list = await createTask(actor, {
  listId: list.id,
  version: list.version,
  operationId: crypto.randomUUID(),
  title: "Remember the synthetic parcel",
});
await db.insert(members).values({ listId: list.id, userId: fixtures[1].id });
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e: Error) => errors.push(e.message));
try {
  const login = await context.request.post(origin + "/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email: fixtures[0].email, password: fixtures[0].password },
  });
  assert.equal(login.status(), 200);
  await page.goto(origin + "/settings/reminders");
  await page.getByRole("heading", { name: "Reminders", exact: true }).waitFor();
  await page.getByLabel(/^Timezone/).fill("Europe/Paris");
  await page.getByRole("button", { name: "Save reminder preferences" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Reminder preferences saved." })
    .waitFor();
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Settings fits ${width}px`,
    );
    await page.screenshot({
      path: `docs/screenshots/reminders-settings-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(origin + `/lists?listId=${list.id}`);
  await page
    .getByRole("button", { name: "List settings", exact: true })
    .click();
  await page
    .getByLabel("Include tasks from this list in my daily nudge")
    .uncheck();
  await page
    .getByRole("button", { name: "Save my list reminders", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your list preference is saved." })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/reminders-list-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Close list settings", exact: true })
    .click();
  const editorContext = await browser.newContext();
  try {
    const login = await editorContext.request.post(
      origin + "/api/auth/sign-in/email",
      {
        headers: { Origin: origin },
        data: { email: fixtures[1].email, password: fixtures[1].password },
      },
    );
    assert.equal(login.status(), 200);
    const editor = await editorContext.newPage();
    await editor.goto(origin + `/lists?listId=${list.id}`);
    await editor
      .getByRole("button", { name: "List settings", exact: true })
      .click();
    await editor.getByRole("heading", { name: "Reminders for me" }).waitFor();
    await editor
      .getByLabel("Include tasks from this list in my daily nudge")
      .waitFor();
    assert.equal(
      await editor
        .getByLabel("Include tasks from this list in my daily nudge")
        .isChecked(),
      true,
      "Owner inclusion is independent of editor preference",
    );
    assert.equal(
      await editor.getByLabel("List type", { exact: true }).count(),
      0,
      "Editors cannot change shared list details",
    );
  } finally {
    await editorContext.close();
  }
  // Navigation may restore another selected list; use the canonical task URL.
  await page.goto(origin + `/tasks/${list.tasks[0].id}`);
  await page.getByRole("button", { name: "Remind me", exact: true }).click();
  await page.getByRole("button", { name: "In one hour", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your reminder is saved." })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Remind me", exact: true }).click();
  await page.getByText(/Scheduled for/).waitFor();
  await page.setViewportSize({ width: 390, height: 1000 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Task reminder fits phone",
  );
  await page.screenshot({
    path: "docs/screenshots/reminders-task-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Remove reminder", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your reminder is removed." })
    .waitFor();
  // API origin and callback signature checks use the actual server routes.
  const forbidden = await context.request.post(origin + "/api/v1/reminders", {
    headers: { Origin: "https://evil.invalid" },
    data: { action: "settings", input: {} },
  });
  assert.equal(forbidden.status(), 403);
  assert.equal(
    (
      await context.request.post(origin + "/api/internal/reminders", {
        data: { id: crypto.randomUUID(), version: 1 },
      })
    ).status(),
    401,
  );
  assert.equal(
    (await context.request.get(origin + "/api/internal/reminders")).status(),
    401,
  );
  const old = await context.request.get(
    origin + "/connections?listId=" + list.id,
    { maxRedirects: 0 },
  );
  assert.equal(old.status(), 307);
  assert.match(old.headers().location, /\/settings\/connections\?listId=/);
  await page.goto(origin + "/connections#cursor");
  assert.match(page.url(), /\/settings\/connections#cursor$/);
  await page
    .getByRole("heading", { name: "Connected AI clients", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Synthetic Settings save/reload, 320/390/1280px layout, task reminder save/remove, owner/editor personal-list settings, origin/signature guards and connection redirect passed.",
  );
} finally {
  await browser.close();
  await db
    .delete(reminderJobs)
    .where(
      and(eq(reminderJobs.userId, actor.id), eq(reminderJobs.kind, "digest")),
    );
  if (oldDigest) await db.insert(reminderJobs).values(oldDigest);
  await db
    .delete(reminderPreferences)
    .where(eq(reminderPreferences.userId, actor.id));
  if (oldPrefs) await db.insert(reminderPreferences).values(oldPrefs);
  await deleteList(actor, {
    listId: list.id,
    version: (await getList(actor, list.id)).version,
    operationId: crypto.randomUUID(),
    confirmed: true,
  });
  await database().pool.end();
}
