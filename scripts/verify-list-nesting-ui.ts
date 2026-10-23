// Synthetic browser proof against the isolated development backend only.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes } from "@wuff/contracts";
import { database } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  getListOrder,
  reorderLists,
  deleteList,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const origin = "http://localhost:3000";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID();
const original = await getListOrder(actor);
const created: string[] = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors: string[] = [];
let debugPage: any;
try {
  async function list(title: string) {
    const value = await createList(actor, { title, operationId: op() });
    created.push(value.id);
    return value;
  }
  const parent = await list("Plant to-dos"),
    other = await list("Weekend plans");
  let child = await list("Repot plants");
  const sibling = await list("Moss pole chores");
  child = await createTask(actor, {
    listId: child.id,
    version: child.version,
    title: "Repot monstera",
    operationId: op(),
  });
  child = await createTask(actor, {
    listId: child.id,
    version: child.version,
    title: "Prepare soil",
    parentTaskId: child.tasks[0].id,
    operationId: op(),
  });
  const beforeTasks = child.tasks;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const login = await context.request.post(origin + "/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email: user.email, password: user.password },
  });
  assert.equal(login.status(), 200);
  const page = await context.newPage();
  debugPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto(origin + `/lists?listId=${child.id}`);
  await expect(
    page.getByRole("heading", { name: "Repot plants", exact: true }),
  ).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "Move list", exact: true });
  async function move(id: string, parentId: string) {
    await page.getByRole("button", { name: "Move list", exact: true }).click();
    await dialog.getByLabel("List", { exact: true }).selectOption(id);
    await dialog
      .getByLabel("Parent list", { exact: true })
      .selectOption(parentId);
    await dialog
      .getByRole("button", { name: "Save location", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await move(child.id, parent.id);
  await move(sibling.id, parent.id);
  const children = page.getByRole("group", {
    name: "Lists under Plant to-dos",
    exact: true,
  });
  await expect(
    children.getByRole("button", { name: "Repot plants", exact: true }),
  ).toBeVisible();
  await expect(
    children.getByRole("button", { name: "Moss pole chores", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Collapse Plant to-dos", exact: true })
    .click();
  await expect(children).not.toBeVisible();
  await page
    .getByRole("button", { name: "Expand Plant to-dos", exact: true })
    .click();
  await expect(children).toBeVisible();
  // The position picker reorders children within their own sibling group.
  await page
    .getByRole("button", { name: "Reorder list Moss pole chores", exact: true })
    .click();
  const position = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "Move list Moss pole chores",
      exact: true,
    }),
  });
  await position.getByLabel("Position", { exact: true }).selectOption("0");
  await position.getByRole("button", { name: "Move", exact: true }).click();
  await expect(position).not.toBeVisible();
  assert.deepEqual(
    (await getListOrder(actor)).listIds.filter((id) =>
      [child.id, sibling.id].includes(id),
    ),
    [sibling.id, child.id],
  );
  await page.getByRole("button", { name: "Move list", exact: true }).click();
  await dialog.getByLabel("List", { exact: true }).selectOption(parent.id);
  await expect(
    dialog.getByLabel("Parent list", { exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  // A committed mutation with a lost HTTP response must retry its exact payload.
  let first = true;
  const bodies: string[] = [];
  await page.route("**/api/v1/list-order", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    bodies.push(route.request().postData());
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Move list", exact: true }).click();
  await dialog.getByLabel("List", { exact: true }).selectOption(child.id);
  await dialog.getByLabel("Parent list", { exact: true }).selectOption("");
  await dialog
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry sidebar change", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Retry sidebar change", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  await page.unroute("**/api/v1/list-order");
  await move(child.id, parent.id);
  await page.reload();
  await expect(
    children.getByRole("button", { name: "Repot plants", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Lists", exact: true })
    .getByRole("button", { name: "Plant to-dos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plant to-dos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open task: Repot monstera", exact: true }),
  ).toHaveCount(0);
  await children
    .getByRole("button", { name: "Repot plants", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Repot plants", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open task: Repot monstera", exact: true }),
  ).toBeVisible();
  assert.deepEqual((await getList(actor, child.id)).tasks, beforeTasks);
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    if (
      width < 768 &&
      !(await page
        .getByRole("navigation", { name: "Lists", exact: true })
        .isVisible())
    )
      await page
        .getByRole("button", { name: "Choose a list", exact: true })
        .click();
    await expect(
      children.getByRole("button", { name: "Repot plants", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `sidebar fits ${width}px`,
    );
    await page.screenshot({
      path: `docs/screenshots/list-nesting-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Move list", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `move dialog fits ${width}px`,
    );
    await page.screenshot({
      path: `docs/screenshots/list-nesting-move-${width}.png`,
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Passed: personal nesting, collapse, sibling ordering, reload, exact-payload uncertain-write retry, own-task views and 320/390/1280px layout.",
  );
  await context.close();
} catch (error) {
  if (debugPage) {
    await debugPage.screenshot({
      path: ".vercel/list-nesting-failure.png",
      fullPage: true,
    });
    console.log(
      await debugPage.locator("dialog[open]").count(),
      await debugPage
        .locator("dialog[open] select")
        .evaluateAll((els: HTMLSelectElement[]) =>
          els.map((el) => ({
            name: el.getAttribute("aria-label"),
            labels: [...(el.labels ?? [])].map((label) => label.textContent),
          })),
        ),
    );
  }
  throw error;
} finally {
  await browser.close();
  for (const id of created) {
    const value = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: value.version,
      operationId: op(),
    });
  }
  const now = await getListOrder(actor);
  await reorderLists(actor, {
    ...original,
    version: now.version,
    operationId: op(),
  });
  await database().pool.end();
}
