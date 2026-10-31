// Optimized local app + isolated development accounts only. Never run on production.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { scopes } from "@wuff/contracts";
import { database } from "@wuff/db";
import {
  createList,
  getList,
  deleteList,
  getListOrder,
  reorderLists,
  listLists,
  getDashboardPreferences,
  updateDashboard,
} from "@wuff/domain";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.WUFF_ORIGIN !== "http://localhost:3000"
)
  throw Error("Isolated loopback development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect = baseExpect.configure({ timeout: 15000 });
const users = JSON.parse(await readFile(".vercel/dev-users.json", "utf8")),
  user = users[0];
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID();
const originalDashboard = await getDashboardPreferences(actor);
const original = await getListOrder(actor),
  created: string[] = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors: string[] = [],
  evidence: string[] = [];
let page: any;
let fixture: ReturnType<typeof spawn> | undefined;
let fixtureExit: Promise<any> | undefined;
async function make(title: string) {
  const list = await createList(actor, { title, operationId: op() });
  created.push(list.id);
  return list;
}
const out = "artifacts/todo-navigation";
await mkdir(out, { recursive: true });
try {
  const parent = await make("UX Laptop master plan"),
    root = await make("UX Standalone errands"),
    children = [];
  for (const title of [
    "01 Unreal foundations",
    "02 Movement and combat",
    "03 Art direction",
    "04 Captain Crumb",
    "05 Waffle Nebula",
    "06 Polish and release",
    "07 Tools and future ideas with a deliberately long name",
  ])
    children.push(await make(title));
  await reorderLists(actor, {
    ...(await getListOrder(actor)),
    nesting: children.map((child) => ({
      listId: child.id,
      parentListId: parent.id,
    })),
    collapsedListIds: [],
    favoriteListIds: [parent.id],
    operationId: op(),
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
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
  page.on("pageerror", (e: Error) => errors.push(e.message));
  async function visit(url: string) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.goto(url);
      if (
        !(await page
          .getByRole("heading", { name: "Paws a moment.", exact: true })
          .isVisible())
      )
        return;
      if (attempt === 3)
        throw Error(
          "Managed session verification remained unavailable after bounded read-only navigation retries",
        );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  await visit("http://localhost:3000/lists?home=1");
  const catalog = page.getByRole("region", { name: "Your lists", exact: true });
  await expect(
    catalog.getByRole("button", { name: root.title, exact: true }),
  ).toBeVisible();
  await updateDashboard(actor, {
    version: originalDashboard.version,
    settings: {
      ...originalDashboard.settings,
      hidden: ["today", "upcoming", "favorites"],
    },
    operationId: op(),
  });
  await visit(page.url());
  await expect(
    page.getByRole("heading", {
      name: "Your day panels are hidden.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: root.title, exact: true }),
  ).toBeVisible();
  await updateDashboard(actor, {
    version: (await getDashboardPreferences(actor)).version,
    settings: originalDashboard.settings,
    operationId: op(),
  });
  await visit(page.url());
  const geometry = await catalog.boundingBox();
  assert(geometry.y >= 0);
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  assert(
    geometry.y >
      (
        await page
          .getByRole("heading", { name: "Today", exact: true })
          .boundingBox()
      ).y,
  );
  const childDisclosure = catalog.getByRole("button", {
    name: "7 child lists",
    exact: true,
  });
  await expect(childDisclosure).toHaveAttribute("aria-expanded", "false");
  await childDisclosure.click();
  await expect(
    catalog.getByRole("button", { name: children[0].title, exact: true }),
  ).toBeVisible();
  await childDisclosure.click();
  await catalog.getByLabel("Find a list").fill("art direction");
  await expect(
    catalog.getByRole("button", { name: parent.title, exact: true }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: children[2].title, exact: true }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: root.title, exact: true }),
  ).toHaveCount(0);
  await catalog.getByLabel("Find a list").fill("no such list fixture");
  await expect(
    catalog.getByText("No lists match your search. Try another name."),
  ).toBeVisible();
  await catalog.getByLabel("Find a list").fill("");
  await expect(childDisclosure).toHaveAttribute("aria-expanded", "false");
  const tree = page.getByRole("navigation", { name: "Lists", exact: true }),
    favorites = page.getByRole("navigation", {
      name: "Favorite lists",
      exact: true,
    });
  await expect(
    tree.getByRole("button", { name: parent.title, exact: true }),
  ).toBeVisible();
  await expect(
    favorites.getByRole("button", { name: children[0].title, exact: true }),
  ).toHaveCount(0);
  const parentX = await tree
    .getByRole("button", { name: parent.title, exact: true })
    .locator(".sidebar-list-name")
    .boundingBox();
  const rootX = await tree
    .getByRole("button", { name: root.title, exact: true })
    .locator(".sidebar-list-name")
    .boundingBox();
  assert.equal(parentX.x, rootX.x);
  evidence.push(
    "Undated/nonfavorite overview lists, search/no matches/context, flat favorite shortcuts/canonical tree, root title alignment",
  );
  const separator = page.getByRole("separator", { name: "Sidebar width" });
  await separator.focus();
  await separator.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "276");
  await visit(page.url());
  await expect(separator).toHaveAttribute("aria-valuenow", "276");
  const box = await separator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 64, box.y + 200);
  await page.mouse.up();
  await expect(separator).toHaveAttribute("aria-valuenow", "340");
  await visit(page.url());
  await expect(separator).toHaveAttribute("aria-valuenow", "340");
  await page.setViewportSize({ width: 800, height: 768 });
  await expect(separator).toHaveAttribute("aria-valuenow", "320");
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(separator).toHaveAttribute("aria-valuenow", "340");
  await page
    .getByRole("button", { name: "Sidebar options", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset width", exact: true }).click();
  await expect(separator).toHaveAttribute("aria-valuenow", "260");
  evidence.push(
    "Keyboard and pointer resizing, reload persistence, narrow-window clamp, preferred width restoration and reset",
  );
  // Exact retry after the server committed a favorite write but its reply was lost.
  const requests: string[] = [];
  let loseReply = true;
  await page.route("**/api/v1/list-order", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    requests.push(route.request().postData());
    if (loseReply) {
      loseReply = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      return route.abort("failed");
    }
    return route.continue();
  });
  await catalog
    .getByRole("button", {
      name: `Add ${root.title} to favorites`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Retry list organization", exact: true })
    .click();
  await expect(
    catalog.getByRole("button", {
      name: `Remove ${root.title} from favorites`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  assert.equal(requests.length, 2);
  assert.equal(requests[0], requests[1]);
  await page.unroute("**/api/v1/list-order");
  await catalog
    .getByRole("button", { name: parent.title, exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Sublists 7", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Sublists 7", exact: true }).click();
  await page
    .getByRole("button", { name: children[0].title, exact: true })
    .filter({ visible: true })
    .last()
    .click();
  await expect(
    page.getByRole("navigation", { name: "List location" }),
  ).toBeVisible();
  await page.getByLabel("Sibling lists").selectOption(children[1].id);
  await expect(
    page.getByRole("heading", { name: children[1].title, exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: children[0].title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "List location" })
    .getByRole("button", { name: `← ${parent.title}`, exact: true })
    .click();
  await page.getByRole("tab", { name: "Sublists 7", exact: true }).click();
  await expect(
    page
      .locator(".sublist-directory")
      .getByRole("button", { name: children[6].title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "List actions", exact: true }).click();
  await page
    .getByRole("dialog", { name: "List actions", exact: true })
    .locator(".list-move-menu > summary")
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "List actions", exact: true })
      .getByRole("combobox", { name: "Parent list", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog", { name: "List actions", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.screenshot({ path: `${out}/parent-laptop.png` });
  evidence.push(
    "Committed-response-loss favorite retry uses identical payload; parent/child/sibling navigation and Back",
  );
  await visit(`http://localhost:3000/lists?listId=${children[0].id}`);
  const actions = page.getByRole("dialog", {
    name: "List actions",
    exact: true,
  });
  await page.getByRole("button", { name: "List actions", exact: true }).click();
  await actions.locator(".list-move-menu > summary").click();
  await actions
    .getByRole("combobox", { name: "Parent list", exact: true })
    .selectOption("");
  await actions.getByRole("button", { name: "Move list", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "List location" }),
  ).toHaveCount(0);
  await actions.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "List actions", exact: true }).click();
  await actions.locator(".list-move-menu > summary").click();
  await actions
    .getByRole("combobox", { name: "Parent list", exact: true })
    .selectOption(parent.id);
  await actions.getByRole("button", { name: "Move list", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "List location" }),
  ).toBeVisible();
  evidence.push(
    "Direct personal move to top level and back; parents with children cannot be nested",
  );
  for (const width of [320, 390, 1024, 1280, 1366, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 800 });
    await visit("http://localhost:3000/lists?home=1");
    await expect(catalog).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    );
    if (width < 768) {
      await expect(separator).toHaveCount(0);
      await page.getByRole("button", { name: "Lists", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Lists", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close lists", exact: true })
        .press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Lists", exact: true }),
      ).not.toBeVisible();
    }
    await page.screenshot({ path: `${out}/overview-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.route("**/api/v1/lists", (route: any) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "internal_error", message: "Synthetic read failure" },
      }),
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Retry lists", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/lists");
  await page.getByRole("button", { name: "Retry lists", exact: true }).click();
  await expect(catalog).toBeVisible();
  evidence.push(
    "320/390/1024/1280/1366/1440px overflow and navigation checks; catalog failure/retry",
  );
  await visit(`http://localhost:3000/lists?listId=${parent.id}`);
  await page.route(`**/api/v1/lists/${parent.id}`, (route: any) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "unavailable", message: "Synthetic detail failure" },
      }),
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("status").filter({ hasText: "Synthetic detail failure" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Sublists 7", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry lists", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(catalog).toBeVisible();
  await page.unroute(`**/api/v1/lists/${parent.id}`);
  evidence.push(
    "A selected-list detail failure preserves the successful catalog and parent context",
  );
  // The existing SDK fixture serves real tool results to the actual embedded app.
  fixture = spawn(
    process.execPath,
    ["--env-file=.env.local", "--import", "tsx", "scripts/browser-fixture.ts"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WUFF_FIXTURE_PORT: "4174" },
    },
  );
  fixtureExit = once(fixture, "exit");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("SDK fixture readiness timeout")),
      60000,
    );
    fixture!.stdout!.on("data", (chunk) => {
      if (String(chunk).includes("Local test host ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    fixture!.on("exit", () => {
      clearTimeout(timeout);
      reject(Error("SDK fixture stopped"));
    });
  });
  const host = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  host.on("pageerror", (e: Error) => errors.push(e.message));
  await host.goto("http://127.0.0.1:4174");
  const frame = host.frameLocator("iframe");
  await frame.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    frame.getByRole("region", { name: "Your lists", exact: true }),
  ).toBeVisible();
  await frame.locator(".home-customize > summary").click();
  await expect(
    frame.getByRole("checkbox", { name: "Favorites", exact: true }),
  ).toHaveCount(0);
  await expect(
    frame.getByRole("checkbox", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(
    frame.getByRole("checkbox", { name: "Coming up", exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "Move Today down", exact: true })
    .click();
  await expect(
    frame.getByRole("button", { name: "Move Today down", exact: true }),
  ).toBeDisabled();
  await frame.getByRole("button", { name: "Cancel", exact: true }).click();
  await frame.getByLabel("Find a list").fill("art direction");
  await frame
    .getByRole("region", { name: "Your lists", exact: true })
    .getByRole("button", { name: parent.title, exact: true })
    .click();
  await expect(
    frame.getByRole("heading", { name: "Child lists (7)", exact: true }),
  ).toBeVisible();
  let degradedReply = false,
    createCalls = 0;
  await host.route("**/mcp", async (route: any) => {
    const request = route.request().postDataJSON();
    if (request.name !== "create_task" || degradedReply)
      return route.continue();
    createCalls++;
    const response = await route.fetch();
    const result = await response.json();
    assert(!result.isError);
    degradedReply = true;
    result.structuredContent = {
      ...result.structuredContent,
      lists: [],
      catalogUnavailable: true,
    };
    await route.fulfill({ response, json: result });
  });
  await frame
    .getByRole("textbox", { name: /^New task/ })
    .first()
    .fill("MCP parent navigation regression");
  await frame.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(
    frame.getByRole("button", {
      name: "Open task: MCP parent navigation regression",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    frame.getByRole("heading", { name: "Child lists (7)", exact: true }),
  ).toHaveCount(0);
  await expect(
    frame.getByRole("textbox", { name: /^New task/ }).first(),
  ).toHaveValue("");
  await expect(
    frame.getByRole("button", { name: "Add", exact: true }).first(),
  ).toBeEnabled();
  assert.equal(createCalls, 1);
  assert.equal(
    (await getList(actor, parent.id)).tasks.filter(
      (task) => task.title === "MCP parent navigation regression",
    ).length,
    1,
  );
  await frame
    .getByRole("button", { name: "Refresh list navigation", exact: true })
    .click();
  await expect(
    frame.getByRole("heading", { name: "Child lists (7)", exact: true }),
  ).toBeVisible();
  await host.unroute("**/mcp");
  evidence.push(
    "Injected post-commit catalog-read failure acknowledges the one real task, resets/enables capture, hides stale navigation and recovers through a read-only refresh",
  );
  await frame
    .getByRole("button", { name: children[0].title, exact: true })
    .click();
  await expect(
    frame.getByRole("heading", { name: children[0].title, exact: true }),
  ).toBeVisible();
  await expect(
    frame.getByRole("navigation", { name: "List location" }),
  ).toBeVisible();
  await frame
    .getByRole("textbox", { name: /^New task/ })
    .first()
    .fill("MCP child navigation regression");
  await frame.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(
    frame.getByRole("button", {
      name: "Open task: MCP child navigation regression",
      exact: true,
    }),
  ).toBeVisible();
  evidence.push(
    "MCP parent and child context survive actual task mutation responses",
  );

  await expect(
    frame.getByRole("navigation", { name: "List location" }),
  ).toBeVisible();
  await frame.getByLabel("Sibling lists").selectOption(children[1].id);
  await expect(
    frame.getByRole("heading", { name: children[1].title, exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "← Your lists", exact: true })
    .click();
  await expect(
    frame.getByRole("heading", { name: "Your lists", exact: true }),
  ).toBeVisible();
  const favoriteNav = frame.getByRole("navigation", {
    name: "Favorite lists",
    exact: true,
  });
  await expect(
    favoriteNav.getByRole("button", { name: parent.title, exact: true }),
  ).toBeVisible();
  await expect(
    favoriteNav.getByRole("button", { name: children[0].title, exact: true }),
  ).toHaveCount(0);
  assert.equal(
    await frame
      .getByRole("button", { name: parent.title, exact: true })
      .count(),
    2,
  );
  await host.screenshot({ path: `${out}/mcp-catalog.png` });
  evidence.push(
    "Actual local MCP Apps SDK host: dashboard catalog search, parent/child/sibling navigation, contextual favorites and canonical tree",
  );
  await host.emulateMedia({ colorScheme: "dark" });
  for (const mode of ["dark", "system"]) {
    await host.evaluate(async (listId: string) => {
      await (window as any).wuffFixtureShowTool("show_list", { listId });
    }, parent.id);
    const appearance = frame.getByRole("combobox", {
      name: "Appearance",
      exact: true,
    });
    await appearance.selectOption(mode);
    await expect
      .poll(() =>
        frame
          .locator("html")
          .evaluate((el: HTMLElement) => getComputedStyle(el).colorScheme),
      )
      .toBe("dark");
    await host.evaluate(async () => {
      await (window as any).wuffFixtureShowTool("show_empire_settings", {});
    });
    await expect(
      frame.getByRole("heading", { name: "Your Wuff Empire", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        frame
          .locator("html")
          .evaluate((el: HTMLElement) => getComputedStyle(el).colorScheme),
      )
      .toBe("light");
    assert.equal(
      await frame
        .locator("html")
        .evaluate((el: HTMLElement) => el.dataset.todoAppearance),
      undefined,
    );
    assert.equal(
      await frame
        .locator("html")
        .evaluate((el: HTMLElement) =>
          el.style.getPropertyValue("--wuff-action"),
        ),
      "",
    );
  }
  await host.emulateMedia({ colorScheme: "light" });
  await host.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      frame
        .locator("html")
        .evaluate((el: HTMLElement) => getComputedStyle(el).colorScheme),
    )
    .toBe("light");
  evidence.push(
    "Real SDK host switches Todo Dark and System to Empire settings: native controls return to light, Todo-owned theme state is cleared, later OS changes leave Empire unaffected",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/verification.json`,
    JSON.stringify({ evidence, errors }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ evidence, errors }, null, 2));
} catch (error) {
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  if (fixture) {
    fixture.kill("SIGINT");
    await fixtureExit;
  }
  for (const id of created.reverse())
    await deleteList(actor, {
      listId: id,
      version: (await getList(actor, id)).version,
      operationId: op(),
    });
  const currentIds = (await listLists(actor)).map((list) => list.id);
  await reorderLists(actor, {
    ...original,
    listIds: [
      ...original.listIds.filter((id) => currentIds.includes(id)),
      ...currentIds.filter((id) => !original.listIds.includes(id)),
    ],
    version: (await getListOrder(actor)).version,
    operationId: op(),
  });
  await updateDashboard(actor, {
    version: (await getDashboardPreferences(actor)).version,
    settings: originalDashboard.settings,
    operationId: op(),
  });
  await database().pool.end();
}
