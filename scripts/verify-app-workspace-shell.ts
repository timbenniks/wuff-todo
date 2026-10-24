// Optimized local app; disposable isolated-development data only.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes } from "@wuff/contracts";
import { database } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  deleteList,
  listLists,
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
  otherActor = { id: other.id, scopes };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ids: string[] = [],
  errors: string[] = [];
let createdTitle = "";
try {
  let list = await createList(actor, {
    title: "Workspace alignment fixture",
    operationId: crypto.randomUUID(),
  });
  ids.push(list.id);
  list = await createTask(actor, {
    listId: list.id,
    version: list.version,
    title: "Keep this task",
    operationId: crypto.randomUUID(),
  });
  const before = JSON.stringify(list.tasks);
  const privateList = await createList(otherActor, {
    title: "Private workspace sentinel",
    operationId: crypto.randomUUID(),
  });
  const anonymous = await browser.newContext();
  try {
    const page = await anonymous.newPage();
    await page.goto("http://localhost:3000/docs");
    await expect(
      page.getByRole("heading", { name: "Make an idea feel like Wuff" }),
    ).toBeVisible();
    assert.equal(await page.locator(".workspace-sidebar").count(), 0);
    const html = await page.content();
    assert(!html.includes(list.id) && !html.includes(privateList.id));
    for (const path of [
      "/docs/agent-context.md",
      "/prototype-kit/wuff-prototype.zip",
    ]) {
      const r = await anonymous.request.get(`http://localhost:3000${path}`);
      assert.equal(r.status(), 200);
    }
    await page.goto("http://localhost:3000/settings/docs");
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await anonymous.close();
    const latest = await getList(otherActor, privateList.id);
    await deleteList(otherActor, {
      listId: latest.id,
      version: latest.version,
      operationId: crypto.randomUUID(),
    });
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://localhost:3000/lists?listId=${list.id}`);
    await expect(page.locator(".list-heading h1")).toHaveText(list.title);
    const logo = await page.locator(".workspace-brand-link").boundingBox(),
      title = await page.locator(".list-heading h1").boundingBox();
    assert(
      Math.abs(logo.y + logo.height / 2 - title.y - title.height / 2) <= 2,
      `title/brand alignment at ${width}`,
    );
    const main = await page.locator(".workspace-main").boundingBox();
    assert.equal(main.x, 260);
    await page.screenshot({
      path: `docs/screenshots/app-shell-list-${width}.png`,
    });
  }
  // Home uses existing cached list state instead of unmounting the workspace.
  await page.getByRole("link", { name: "Wuff Todo Home", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your day", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/home=1/);
  await page.goBack();
  await expect(page.locator(".list-heading h1")).toHaveText(list.title);
  await page.locator(".sidebar-settings").click();
  await expect(page).toHaveURL(/\/settings\/reminders/);
  await expect(page.locator(".workspace-main h1").first()).toHaveText(
    "Settings",
  );
  await expect(
    page.locator('.workspace-settings-nav a[aria-current="page"]'),
  ).toHaveText("Reminders");
  assert.equal(await page.locator(".sidebar-home[aria-current]").count(), 0);
  await page
    .getByRole("navigation", { name: "Settings", exact: true })
    .getByRole("link", { name: "Docs", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/docs$/);
  await expect(
    page.getByRole("heading", { name: "Make an idea feel like Wuff" }),
  ).toBeVisible();
  await expect(
    page.locator('.workspace-settings-nav a[aria-current="page"]'),
  ).toHaveText("Docs");
  assert(!(await page.content()).includes(privateList.id));
  const main = page.locator(".workspace-main");
  await main.evaluate((el: HTMLElement) => {
    el.scrollTop = 400;
  });
  assert.equal(
    await page
      .locator(".workspace-sidebar")
      .evaluate((el: HTMLElement) => el.getBoundingClientRect().top),
    0,
  );
  await main.evaluate((el: HTMLElement) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: "docs/screenshots/app-shell-docs-1920.png" });
  await page
    .getByRole("navigation", { name: "Guide pages" })
    .getByRole("link", { name: "Design language", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/docs\/design$/);
  await page.getByRole("button", { name: "Sage", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sage", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.locator('.workspace-settings-nav a[aria-current="page"]'),
  ).toHaveText("Docs");
  await page.locator(".workspace-brand-link").click();
  await expect(
    page.getByRole("heading", { name: "Your day", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://localhost:3000/settings/docs");
    await expect(
      page.getByRole("button", { name: "Lists", exact: true }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/app-shell-docs-${width}.png`,
    });
    await page
      .locator(".docs-mobile-nav select")
      .selectOption("/settings/docs/components");
    await expect(page).toHaveURL(/\/settings\/docs\/components$/);
    await expect(
      page.getByRole("heading", { name: "Find a component", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Lists", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Lists", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('.workspace-settings-nav a[aria-current="page"]'),
    ).toHaveText("Docs");
    await page.screenshot({
      path: `docs/screenshots/app-shell-navigation-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lists", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Lists", exact: true }).click();
    await dialog
      .getByRole("button", { name: list.title, exact: true })
      .first()
      .click();
    await expect(page.locator(".list-heading h1")).toHaveText(list.title);
  }
  // Creation from Settings stays in the modal through an uncertain committed save.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:3000/settings/connections");
  const bodies: string[] = [];
  await page.route("**/api/v1/lists", async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData());
    const response = await route.fetch();
    if (bodies.length === 1) return route.abort();
    return route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  createdTitle = `Workspace create ${crypto.randomUUID()}`;
  const createDialog = page.getByRole("dialog");
  await createDialog
    .getByLabel("List name", { exact: true })
    .fill(createdTitle);
  await createDialog
    .getByRole("button", { name: "Create list", exact: true })
    .click();
  await expect(
    createDialog.getByRole("button", {
      name: "Retry saving list",
      exact: true,
    }),
  ).toBeVisible();
  assert(!page.url().includes("pending-"));
  await page.keyboard.press("Escape");
  await expect(createDialog).not.toBeVisible();
  await page
    .locator(".workspace-main")
    .getByRole("button", { name: "Retry saving list", exact: true })
    .click();
  await expect(page.locator(".list-heading h1")).toHaveText(createdTitle);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(
    (await listLists(actor)).filter((l) => l.title === createdTitle).length,
    1,
  );
  assert.equal(JSON.stringify((await getList(actor, list.id)).tasks), before);
  assert.deepEqual(errors, []);
  console.log(
    "App shell passed: Home/history, desktop alignment, Settings/Docs navigation, mobile escape/overflow, public/auth isolation, exact create retry, task preservation; no page errors.",
  );
} finally {
  await browser.close();
  for (const list of await listLists(actor)) {
    if (
      !ids.includes(list.id) &&
      (!createdTitle || list.title !== createdTitle)
    )
      continue;
    const latest = await getList(actor, list.id);
    await deleteList(actor, {
      listId: latest.id,
      version: latest.version,
      operationId: crypto.randomUUID(),
    });
  }
  await database().pool.end();
}
