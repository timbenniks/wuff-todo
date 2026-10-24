// Optimized localhost website; synthetic data in the existing isolated development branch.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes } from "@wuff/contracts";
import { database, members } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  listLists,
  deleteList,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect = baseExpect.configure({ timeout: 15000 });
const [user, other] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID(),
  ids = new Set<string>();
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let page: any;
const errors: string[] = [];
const createdTitle = `Phase 2 create ${op()}`;
try {
  let work = await createList(actor, {
    title:
      "Phase 2 release planning with a long list name that remains readable on phones",
    mode: "work",
    operationId: op(),
  });
  ids.add(work.id);
  let basic = await createList(actor, {
    title: "Phase 2 everyday errands",
    operationId: op(),
  });
  ids.add(basic.id);
  await database()
    .db.insert(members)
    .values({ listId: work.id, userId: other.id });
  work = await createTask(actor, {
    listId: work.id,
    version: work.version,
    title: "Review editor permissions before release",
    status: "in_progress",
    priority: "high",
    assigneeId: user.id,
    references: [
      {
        url: "https://example.invalid/" + "reference/".repeat(100),
        title: "Supporting document " + "with more context ".repeat(8),
      },
    ],
    content:
      "# Long supporting notes\n\n" +
      "Keep context and unsaved edits when moving between the list and task.\n\n".repeat(
        35,
      ),
    operationId: op(),
  });
  const task = work.tasks[0];
  work = await createTask(actor, {
    listId: work.id,
    version: work.version,
    title: "Check keyboard access",
    parentTaskId: task.id,
    operationId: op(),
  });
  basic = await createTask(actor, {
    listId: basic.id,
    version: basic.version,
    title: "Pick up coffee",
    operationId: op(),
  });
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
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  const go = async (id: string) => {
    await page.goto(`http://localhost:3000/lists?listId=${id}`);
    await expect(page.locator(".list-heading h1")).toBeVisible();
  };
  const oneModal = async () =>
    assert.equal(await page.locator("dialog:modal").count(), 1);
  await go(work.id);
  const lists = page.getByRole("button", { name: "Lists", exact: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(lists).toBeVisible();
    const before = (await page.locator(".list-heading").boundingBox())!.y;
    await lists.click();
    const nav = page.getByRole("dialog", { name: "Lists", exact: true });
    await expect(nav).toBeVisible();
    await oneModal();
    const current = nav.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(work.title);
    await expect(current.locator("span.truncate").first()).toHaveCSS(
      "white-space",
      "normal",
    );
    await page.screenshot({
      path: `docs/screenshots/ux-phase-two-navigation-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(nav).not.toBeVisible();
    await expect(lists).toBeFocused();
    assert.equal(
      (await page.locator(".list-heading").boundingBox())!.y,
      before,
      "navigation does not displace list",
    );
    await expect(
      page.locator(`[data-task-id="${task.id}"] .task-phone-work-summary`),
    ).toContainText("In progress");
    await expect(
      page.locator(`[data-task-id="${task.id}"] .task-phone-work-summary`),
    ).not.toContainText("Unassigned");
  }
  // A short viewport forces navigation scrolling; reopen keeps its position.
  await page.setViewportSize({ width: 390, height: 320 });
  await lists.click();
  const scrollingNavigation = page.getByRole("dialog", {
    name: "Lists",
    exact: true,
  });
  const scroll = scrollingNavigation.locator(".workspace-list-nav");
  const savedScroll = await scroll.evaluate((el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  });
  assert.ok(savedScroll > 0, "navigation has an independent scroll area");
  await scrollingNavigation
    .getByRole("button", { name: "Close lists", exact: true })
    .click();
  await lists.click();
  assert.equal(
    await scroll.evaluate((el: HTMLElement) => el.scrollTop),
    savedScroll,
  );
  await scrollingNavigation
    .getByRole("button", { name: "Close lists", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    scrollingNavigation.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    scrollingNavigation.getByRole("button", {
      name: "Close lists",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await lists.click();
  let nav = page.getByRole("dialog", { name: "Lists", exact: true });
  await nav.getByRole("button", { name: basic.title, exact: true }).click();
  await expect(nav).not.toBeVisible();
  await expect(page.locator(".list-heading h1")).toHaveText(basic.title);
  await lists.click();
  nav = page.getByRole("dialog", { name: "Lists", exact: true });
  await nav.getByRole("button", { name: /^Phase 2 release planning/ }).click();
  await expect(page.locator(".list-heading h1")).toHaveText(work.title);
  // Create replaces the Lists sheet; its draft survives Back and Escape.
  await lists.click();
  await nav.getByRole("button", { name: "Create list", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create list", exact: true });
  await oneModal();
  await expect(
    create.getByRole("textbox", { name: "List name", exact: true }),
  ).toBeFocused();
  await expect(
    create.getByRole("combobox", { name: "List type", exact: true }),
  ).toHaveValue("simple");
  await create
    .getByRole("textbox", { name: "List name", exact: true })
    .fill(createdTitle);
  await create
    .getByRole("combobox", { name: "List type", exact: true })
    .selectOption("work");
  await create
    .getByRole("button", { name: "Back to lists", exact: true })
    .click();
  await nav.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    create.getByRole("textbox", { name: "List name", exact: true }),
  ).toHaveValue(createdTitle);
  await page.keyboard.press("Escape");
  await expect(lists).toBeFocused();
  await lists.click();
  await nav.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    create.getByRole("combobox", { name: "List type", exact: true }),
  ).toHaveValue("work");
  await page.screenshot({
    path: "docs/screenshots/ux-phase-two-create-390.png",
  });
  let lost = true;
  const bodies: string[] = [];
  await page.route("**/api/v1/lists", async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData());
    if (lost) {
      lost = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      ids.add((await response.json()).id);
      await route.abort("failed");
    } else await route.continue();
  });
  await create
    .getByRole("button", { name: "Create list", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry saving list", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry saving list", exact: true })
    .click();
  const capture = page.getByRole("dialog", { name: "Add task", exact: true });
  await expect(capture).toBeVisible();
  await oneModal();
  await expect(
    capture.getByRole("textbox", { name: "Task name", exact: true }),
  ).toBeFocused();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(JSON.parse(bodies[0]).mode, "work");
  const created = (await listLists(actor)).filter(
    (l) => l.title === createdTitle,
  );
  assert.equal(created.length, 1);
  ids.add(created[0].id);
  assert.equal((await getList(actor, created[0].id)).mode, "work");
  await page.unroute("**/api/v1/lists");
  await capture.getByRole("button", { name: "Cancel", exact: true }).click();
  await go(work.id);
  // All phone view pages are regions within the same modal, never popovers.
  const view = page.getByRole("dialog", { name: "Your view", exact: true });
  await page.locator(".mobile-view-trigger").click();
  await view.getByRole("button", { name: "Done", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    view.getByRole("button", { name: "Close view options", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    view.getByRole("button", { name: "Done", exact: true }),
  ).toBeFocused();
  for (const name of ["Filter", "Sort", "Group", "Display", "Presets"]) {
    const trigger = view.getByRole("button", {
      name: new RegExp(`^${name}(?: · [0-9]+)?$`),
    });
    await trigger.click();
    const region = view.getByRole("region", { name, exact: true });
    await expect(region).toBeVisible();
    await oneModal();
    assert.equal(await page.locator("[popover]:popover-open").count(), 0);
    if (name === "Filter")
      await region
        .getByRole("combobox", { name: "Priority filter", exact: true })
        .selectOption("high");
    if (name === "Display")
      await expect(
        region.getByRole("combobox", { name: "Row layout", exact: true }),
      ).toHaveCount(0);
    await page.screenshot({
      path: `.vercel/ux-phase-two-view-${name.toLowerCase()}.png`,
    });
    await region
      .getByRole("button", { name: "Back to view", exact: true })
      .click();
    await expect(trigger).toBeFocused();
  }
  await view.getByRole("button", { name: "Filter · 1", exact: true }).click();
  await page.screenshot({ path: "docs/screenshots/ux-phase-two-view-390.png" });
  await view.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".mobile-view-trigger")).toBeFocused();
  await page.locator(".mobile-view-trigger").click();
  await view.getByRole("button", { name: "Filter · 1", exact: true }).click();
  await expect(
    view.getByRole("combobox", { name: "Priority filter", exact: true }),
  ).toHaveValue("high");
  await view.getByRole("button", { name: "Done", exact: true }).click();
  // Work editing is before long notes; cancellation and resize preserve independent notes.
  const link = page.getByRole("link", {
    name: `Open task: ${task.title}`,
    exact: true,
  });
  await link.click();
  const drawer = page.getByRole("dialog", {
    name: "Task details",
    exact: true,
  });
  await expect(
    drawer.getByRole("button", { name: "Change status", exact: true }),
  ).toBeVisible();
  const workPanel = drawer.locator(".work-details"),
    notes = drawer.locator(".task-detail-notes");
  assert.ok(
    (await workPanel.boundingBox())!.y < (await notes.boundingBox())!.y,
  );
  await page.screenshot({
    path: "docs/screenshots/ux-phase-two-details-390.png",
  });
  await drawer
    .getByRole("button", { name: "Change status", exact: true })
    .click();
  await expect(
    drawer.getByRole("combobox", { name: "Status", exact: true }),
  ).toBeFocused();
  await drawer
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("in_review");
  await drawer
    .getByRole("button", { name: "Save work details", exact: true })
    .click();
  await expect(
    drawer.getByRole("button", { name: "Change status", exact: true }),
  ).toBeFocused();
  let saved = await getList(actor, work.id);
  assert.equal(saved.tasks.find((t) => t.id === task.id)!.status, "in_review");
  assert.equal(saved.tasks.find((t) => t.id === task.id)!.completed, false);
  await drawer
    .getByRole("button", { name: "Edit task notes", exact: true })
    .click();
  const editor = drawer.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible();
  await editor.fill("Draft retained across work status editing and resize.");
  await drawer
    .getByRole("button", { name: "Change status", exact: true })
    .click();
  await drawer
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("blocked");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(editor).toContainText("Draft retained");
  await drawer
    .getByRole("button", { name: "Cancel work details", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Close task details", exact: true })
    .click();
  await expect(
    drawer.getByText(
      "You have unsaved edits. Discard them and leave this task?",
      { exact: true },
    ),
  ).toBeVisible();
  await drawer
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(editor).toContainText("Draft retained");
  await drawer
    .getByRole("button", { name: "Close task details", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Discard edits", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  await expect(link).toBeFocused();
  await page.goto(`http://localhost:3000${task.path}`);
  await expect(page.locator(".work-details")).toBeVisible();
  const wb = (await page.locator(".work-details").boundingBox())!,
    nb = (await page.locator(".task-detail-notes").boundingBox())!;
  assert.ok(wb.x > nb.x, "standalone desktop Work details retain right column");
  const subtaskHeading = (await page
    .getByRole("heading", { name: "Subtasks", exact: true })
    .boundingBox())!;
  assert.ok(
    subtaskHeading.y < wb.y + wb.height + 120,
    "desktop subtasks follow Work details without a long-notes gap",
  );
  await page.screenshot({
    path: "docs/screenshots/ux-phase-two-details-desktop.png",
  });
  await page
    .getByRole("button", { name: "Complete task", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen task", exact: true }),
  ).toBeVisible();
  saved = await getList(actor, work.id);
  assert.equal(saved.tasks.find((t) => t.id === task.id)!.status, "done");
  assert.equal(saved.tasks.find((t) => t.id === task.id)!.completed, true);
  await go(basic.id);
  await page
    .getByRole("link", { name: "Open task: Pick up coffee", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Task details", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".work-details")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change status", exact: true }),
  ).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 2 passed: phone navigation/context/full names, single-sheet View pages and draft retention, focused create with exact lost-response retry/capture handoff, phone Work hierarchy/status saving, independent note drafts/dirty close/resize, desktop columns, completion/Done and Basic scope.",
  );
} catch (error) {
  await page?.screenshot({
    path: ".vercel/ux-phase-two-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  for (const list of await listLists(actor))
    if (list.title === createdTitle) ids.add(list.id);
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
