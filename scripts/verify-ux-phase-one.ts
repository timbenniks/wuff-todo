// Optimized website, existing isolated development branch, disposable fixtures only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes, defaultListView } from "@wuff/contracts";
import { database, members } from "@wuff/db";
import {
  createList,
  createSection,
  createTask,
  getList,
  deleteList,
  updateList,
  updateListView,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect = baseExpect.configure({ timeout: 15000 });
const [user, editor] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID(),
  ids: string[] = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let page: any;
try {
  let list = await createList(actor, {
    title: "UX phase one long list",
    mode: "work",
    operationId: op(),
  });
  ids.push(list.id);
  list = await createSection(actor, {
    listId: list.id,
    version: list.version,
    title: "Errands",
    operationId: op(),
  });
  const longTitle =
    "Review sharing and editor permissions before the next release with a long task name";
  for (let i = 0; i < 100; i++)
    list = await createTask(actor, {
      listId: list.id,
      version: list.version,
      title: i ? `Synthetic task ${i}` : longTitle,
      operationId: op(),
    });
  console.log("Prepared 100-task isolated fixture.");
  const baseline = list.tasks.length;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto(`http://localhost:3000/lists?listId=${list.id}`);
  await expect(
    page.getByRole("heading", { name: list.title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mobile-view-trigger")).toBeVisible();
  const capture = page.getByRole("dialog", { name: "Add task", exact: true });
  const trigger = page.locator(".task-capture-trigger");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(trigger).toBeVisible();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector(".workspace-main")?.scrollTo(0, 0);
    });
    const rect = (await trigger.boundingBox())!;
    assert.ok(
      rect.y >= 0 && rect.y + rect.height <= 844,
      `capture reachable at ${width}`,
    );
    assert.ok(rect.height >= 44);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const title = page
      .locator(".inline-name-value")
      .filter({ hasText: longTitle })
      .first();
    if (width < 768) {
      await expect(title).toHaveCSS("-webkit-line-clamp", "2");
      assert.ok(
        (await title.boundingBox())!.height > 22,
        "long title uses two lines",
      );
    }
    await trigger.click();
    await expect(
      capture.getByRole("textbox", { name: "Task name" }),
    ).toBeFocused();
    await capture
      .getByRole("textbox", { name: "Task name" })
      .fill("Keep this draft");
    await capture.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(
      capture.getByRole("textbox", { name: "Task name" }),
    ).toHaveValue("Keep this draft");
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-view-trigger")).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search title or key",
    exact: true,
  });
  await search.fill("Nothing matches this phrase");
  await expect(
    page.getByText(
      "No tasks match your search. Clear the search or filters to see your tasks.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Clear Search: Nothing matches this phrase",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/ux-phase-one-filters-390.png",
  });
  await trigger.click();
  await capture
    .getByRole("textbox", { name: "Task name" })
    .fill("Captured under active filters");
  await capture
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption(list.sections[0].id);
  // A rejected write keeps its draft; a second submission is blocked while pending.
  await page.route("**/api/v1/tasks", (route: any) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "conflict",
              message: "Synthetic conflict: reload and retry.",
            },
          }),
        })
      : route.continue(),
  );
  await capture.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(capture.getByRole("alert")).toBeVisible();
  await expect(capture.getByRole("textbox", { name: "Task name" })).toHaveValue(
    "Captured under active filters",
  );
  assert.equal((await getList(actor, list.id)).tasks.length, baseline);
  await page.unroute("**/api/v1/tasks");
  const bodies: string[] = [];
  let lost = true;
  await page.route("**/api/v1/tasks", async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData());
    if (lost) {
      lost = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("failed");
    } else await route.continue();
  });
  await capture.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    capture.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(capture.getByRole("textbox", { name: "Task name" })).toHaveValue(
    "Captured under active filters",
  );
  await capture
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(capture).not.toBeVisible();
  assert.equal(bodies.length, 2);
  assert.equal(
    bodies[0],
    bodies[1],
    "identical operation ID and payload on retry",
  );
  await page.unroute("**/api/v1/tasks");
  let current = await getList(actor, list.id);
  assert.equal(current.tasks.length, baseline + 1);
  assert.equal(
    current.tasks.find((t) => t.title === "Captured under active filters")
      ?.sectionId,
    list.sections[0].id,
  );
  await expect(
    page.getByText(/Your filters still apply and may hide the task/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(
    page.getByRole("link", {
      name: "Open task: Captured under active filters",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/ux-phase-one-list-390.png" });
  // Existing saved view remains unchanged until Save; clearing preserves display/sort.
  current = await getList(actor, list.id);
  assert.equal(current.personalView!.version, 0);
  assert.equal(current.personalView!.view.search, "");
  current = await updateListView(actor, {
    listId: list.id,
    viewVersion: 0,
    view: {
      ...defaultListView(),
      search: "not-found",
      sortBy: "due",
      layout: "detailed",
      columns: ["status"],
      groupBy: "date",
      statuses: ["blocked"],
    },
    operationId: op(),
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Clear filters", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.locator(".mobile-view-trigger").click();
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save view", exact: true }),
  ).toHaveCount(0);
  current = await getList(actor, list.id);
  assert.equal(current.personalView!.view.search, "");
  assert.deepEqual(current.personalView!.view.statuses, []);
  assert.equal(current.personalView!.view.sortBy, "due");
  assert.equal(current.personalView!.view.layout, "detailed");
  assert.equal(current.personalView!.view.groupBy, "date");
  assert.deepEqual(current.personalView!.view.columns, ["status"]);
  await page
    .getByRole("button", { name: "Close view options", exact: true })
    .click();
  await trigger.click();
  await expect(capture.getByRole("textbox", { name: "Task name" })).toHaveValue(
    "",
  );
  await page.screenshot({
    path: "docs/screenshots/ux-phase-one-capture-390.png",
  });
  await page.keyboard.press("Escape");
  // Editor capture uses the same domain permissions; archive removes capture.
  await database()
    .db.insert(members)
    .values({ listId: list.id, userId: editor.id });
  const editorContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const editorLogin = await editorContext.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: editor.email, password: editor.password },
    },
  );
  assert.equal(editorLogin.status(), 200);
  const editorPage = await editorContext.newPage();
  await editorPage.goto(`http://localhost:3000/lists?listId=${list.id}`);
  await editorPage.locator(".task-capture-trigger").click();
  const editorCapture = editorPage.getByRole("dialog", {
    name: "Add task",
    exact: true,
  });
  await editorCapture
    .getByRole("textbox", { name: "Task name" })
    .fill("Editor capture");
  await editorCapture
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(editorCapture).not.toBeVisible();
  current = await getList(actor, list.id);
  assert.equal(current.tasks.length, baseline + 2);
  current = await updateList(actor, {
    listId: list.id,
    version: current.version,
    archived: true,
    operationId: op(),
  });
  await page.reload();
  await expect(page.getByText(/This list is taking a paws/)).toBeVisible();
  await expect(trigger).toHaveCount(0);
  await expect(page.locator(".task-add")).toHaveCount(0);
  await editorContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 1 passed: 100-task capture, responsive titles/targets, draft close/failure recovery, exact lost-response retry without duplicates, filter recovery/persistence/display preservation, editor capture and archived restrictions.",
  );
} catch (error) {
  await page?.screenshot({
    path: ".vercel/ux-phase-one-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  for (const id of ids) {
    const list = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: list.version,
      operationId: op(),
    });
  }
  await database().pool.end();
}
