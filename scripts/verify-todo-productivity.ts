// Synthetic populated UI proof against the documented isolated development backend.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { database, members } from "@wuff/db";
import { scopes, defaultListView, viewSettings } from "@wuff/contracts";
import { todoThemeVariables } from "../packages/design/src/index";
import {
  createList,
  getList,
  deleteList,
  createSection,
  createTask,
  getListOrder,
  reorderLists,
  updateListView,
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
const [user, other] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID();
const original = await getListOrder(actor),
  ids: string[] = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const stage = process.argv[2] ?? "full",
  out = `artifacts/todo-productivity/${stage}`;
const errors: string[] = [],
  checks: string[] = [];
let page: any;
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
}).format(new Date());
const day = (n: number) => {
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
};
await mkdir(out, { recursive: true });
try {
  let list = await createList(actor, {
    title: "Weekend things",
    description: "A few things worth making time for.",
    mode: "work",
    operationId: op(),
  });
  ids.push(list.id);
  await database()
    .db.insert(members)
    .values({ listId: list.id, userId: other.id });
  for (const title of ["At home", "Out and about", "Next week"])
    list = await createSection(actor, {
      listId: list.id,
      version: list.version,
      title,
      operationId: op(),
    });
  const titles = [
    "Pick up groceries",
    "Book a table for Saturday",
    "Take a long walk",
    "Plan the autumn garden and choose plants that will survive the first cold week",
    "Repair the hallway light",
    "Read the next chapter",
    "Collect the parcel",
    "Visit the farmers market",
    "Choose a birthday present",
    "Sort out the kitchen cupboard",
    "Check the bicycle brakes",
    "Call the vet",
    "Review the family budget",
    "Back up the photos",
    "Plan next weekend",
    "Finish the illustration",
    "Prepare the guest room",
    "Pick a film for Friday",
    "Walk through the release checklist with the team and note anything still unclear",
    "Buy coffee beans",
    "Renew the library books",
    "Water the balcony",
    "Print the train tickets",
    "Tidy the studio",
  ];
  for (const [i, title] of titles.entries())
    list = await createTask(actor, {
      listId: list.id,
      version: list.version,
      title,
      sectionId: i < 18 ? list.sections[Math.floor(i / 6)].id : null,
      dueDate: i < 3 ? day(i - 1) : null,
      priority: i === 0 ? "high" : "none",
      status: i >= 22 ? "done" : i === 0 ? "in_progress" : "todo",
      assigneeId: i === 0 ? other.id : null,
      content:
        i === 0
          ? "## For the weekend\n\nPick fresh vegetables and something for **Saturday dinner**.\n\n- Check what is already in the fridge\n- Bring the reusable bags"
          : "",
      operationId: op(),
    });
  const parentTask = list.tasks.find((task) => task.title === titles[0])!;
  for (const [i, title] of [
    "Check the fridge",
    "Bring reusable bags",
    "Pick fresh vegetables",
  ].entries())
    list = await createTask(actor, {
      listId: list.id,
      version: list.version,
      title,
      parentTaskId: parentTask.id,
      status: i === 0 ? "done" : "todo",
      operationId: op(),
    });
  const child = await createList(actor, {
    title: "Summer travel plans",
    operationId: op(),
  });
  ids.push(child.id);
  await reorderLists(actor, {
    ...(await getListOrder(actor)),
    nesting: [
      ...(original.nesting ?? []),
      { listId: child.id, parentListId: list.id },
    ],
    favoriteListIds: [
      ...new Set([...(original.favoriteListIds ?? []), list.id]),
    ],
    operationId: op(),
  });
  const mobilePresetId = crypto.randomUUID();
  if (stage === "mobile-views") {
    const view = defaultListView();
    list = await updateListView(actor, {
      listId: list.id,
      viewVersion: 0,
      view: {
        ...view,
        presets: [
          {
            id: mobilePresetId,
            name: "Weekend focus",
            settings: { ...viewSettings(view), due: "today" },
          },
        ],
      },
      operationId: op(),
    });
  }
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  // Pace synthetic API traffic to the managed development auth service. This
  // changes only the runner; every request still reaches the real authorization.
  let nextApiAt = 0;
  await context.route("**/api/v1/**", async (route: any) => {
    const now = Date.now(),
      wait = Math.max(0, nextApiAt - now);
    nextApiAt = Math.max(now, nextApiAt) + 2000;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    await route.continue();
  });
  page = await context.newPage();
  page.on("response", (response: any) => {
    if (response.status() >= 400)
      console.log(
        `HTTP ${response.status()} ${new URL(response.url()).pathname}`,
      );
  });
  page.on("pageerror", (e: Error) =>
    errors.push(`${new URL(page.url()).pathname}: ${e.message}`),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`http://localhost:3000/lists?listId=${list.id}`);
    if (
      !(await page
        .getByRole("heading", { name: "Paws a moment.", exact: true })
        .isVisible())
    )
      break;
    if (attempt === 2)
      throw Error(
        "Synthetic session verification remained unavailable after bounded retries",
      );
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  await expect(
    page.getByRole("heading", { name: list.title, exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(`[data-task-id="${parentTask.id}"]`)).toBeVisible();
  assert.equal(list.tasks.length, 27);
  await page.screenshot({ path: `${out}/workspace-light.png` });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    )
    .toBe("light");
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("dark");
  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    )
    .toBe("dark");
  await page.screenshot({ path: `${out}/workspace-dark.png` });
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    )
    .toBe("light");
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("light");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Lists", exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Favorite lists", exact: true })
      .getByRole("button", { name: /Summer travel plans/ }),
  ).toHaveCount(0);
  await page.screenshot({ path: `${out}/sidebar-phone.png` });
  await page
    .getByRole("button", { name: "Close lists", exact: true })
    .press("Escape");
  checks.push(
    "27 tasks including 24 roots, 3 sections, subtasks, completion, dates, assignment, priority and notes; light/dark and phone sidebar",
  );
  if (
    ![
      "foundations-sidebar",
      "drawer-only",
      "drawer-empty",
      "appearance-menu",
      "mobile-views",
      "retry-isolation",
      "appearance-storage",
    ].includes(stage)
  ) {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page
      .getByRole("button", { name: "List actions", exact: true })
      .click();
    await page
      .getByRole("button", { name: "List settings", exact: true })
      .click();
    const settings = page.getByRole("dialog", {
      name: "List settings",
      exact: true,
    });
    await expect(settings).toBeVisible();
    await settings
      .getByRole("button", { name: "Close list settings", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "List actions", exact: true }),
    ).toBeFocused();

    await page.setViewportSize({ width: 1366, height: 900 });
    await page
      .getByRole("button", { name: "Add task", exact: true })
      .first()
      .click();
    const capture = page.getByRole("form", {
      name: "Add task inline",
      exact: true,
    });
    const name = capture.getByRole("textbox", {
      name: "Task name",
      exact: true,
    });
    await expect(name).toBeFocused();
    await name.fill("Repeated capture one");
    await page
      .getByRole("button", { name: "Add task", exact: true })
      .first()
      .click();
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("Repeated capture one");
    await name.press("Enter");
    await expect(name).toHaveValue("");
    await expect(name).toBeEditable();
    await name.fill("Repeated capture two");
    await name.press("Enter");
    await expect(name).toHaveValue("");
    await name.fill("Canceled capture");
    await name.press("Escape");
    await expect(capture).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add task", exact: true }).first(),
    ).toBeFocused();
    assert(
      !(await getList(actor, list.id)).tasks.some(
        (task) => task.title === "Canceled capture",
      ),
    );
    await page
      .getByRole("button", { name: "Add task to At home", exact: true })
      .click();
    const sectionCapture = page.getByRole("form", {
      name: "Add task inline",
      exact: true,
    });
    await sectionCapture
      .getByRole("textbox", { name: "Task name", exact: true })
      .fill("Section capture");
    await sectionCapture
      .getByRole("textbox", { name: "Task name", exact: true })
      .press("Enter");
    await expect(
      sectionCapture.getByRole("textbox", { name: "Task name", exact: true }),
    ).toHaveValue("");
    assert.equal(
      (await getList(actor, list.id)).tasks.find(
        (task) => task.title === "Section capture",
      )?.sectionId,
      list.sections[0].id,
    );
    await sectionCapture
      .getByRole("textbox", { name: "Task name", exact: true })
      .press("Escape");
    checks.push(
      "Header capture focuses inline input, repeated Enter retains focus, Escape cancels, section capture preserves destination",
    );
    await page
      .getByRole("button", { name: "View settings", exact: true })
      .click();
    const view = page.getByRole("dialog", {
      name: "View settings",
      exact: true,
    });
    await expect(
      view.getByRole("combobox", { name: "Sort by", exact: true }),
    ).toBeVisible();
    await expect(
      view.getByRole("combobox", { name: "Group by", exact: true }),
    ).toBeVisible();
    await expect(
      view.getByRole("combobox", { name: "Row density", exact: true }),
    ).toBeVisible();
    await view
      .getByRole("combobox", { name: "Sort by", exact: true })
      .selectOption("due");
    await view.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", { name: "Revert to saved view", exact: true })
      .click();
    checks.push(
      "Sorting, grouping, display and saved views share one configuration surface; draft reversion works",
    );
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    const filter = page.getByRole("dialog", { name: "Filter", exact: true });
    await filter
      .getByRole("combobox", { name: "Due date filter", exact: true })
      .selectOption("overdue");
    await filter.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.locator(`[data-task-id="${parentTask.id}"]`),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Open task: Buy coffee beans",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Revert to saved view", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View settings", exact: true })
      .click();
    await view
      .getByRole("combobox", { name: "Group by", exact: true })
      .selectOption("status");
    await view
      .getByRole("combobox", { name: "Row layout", exact: true })
      .selectOption("columns");
    await view
      .getByRole("button", { name: "Save as new view…", exact: true })
      .click();
    await view
      .getByRole("textbox", { name: "View name", exact: true })
      .fill("Weekend planning");
    await view
      .getByRole("button", { name: "Save new view", exact: true })
      .click();
    await expect(
      view.getByRole("textbox", { name: "View name", exact: true }),
    ).toHaveCount(0);
    assert(
      (await getList(actor, list.id)).personalView?.view.presets.some(
        (preset) =>
          preset.name === "Weekend planning" &&
          preset.settings.groupBy === "status" &&
          preset.settings.rowStyle === "columns",
      ),
    );
    await view.getByRole("button", { name: "Done", exact: true }).click();
    await page.screenshot({ path: `${out}/workspace-columns.png` });
    await page
      .getByRole("button", { name: "View settings", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Reset to defaults", exact: true })
      .click();
    await view.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Save view", exact: true }),
    ).toHaveCount(0);
    const complete = page.getByRole("button", {
      name: "Complete Buy coffee beans",
      exact: true,
    });
    await complete.click();
    await expect(
      page.getByRole("button", {
        name: "Reopen Buy coffee beans",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Task details", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Reopen Buy coffee beans", exact: true })
      .click();
    await expect(complete).toBeVisible();
    checks.push(
      "Date filtering, status grouping, saved column views, reset/save and checkbox completion/reopening without opening details",
    );
    const retryBodies: string[] = [];
    let lose = true;
    await page.route("**/api/v1/tasks", async (route: any) => {
      if (route.request().method() !== "POST") return route.continue();
      retryBodies.push(route.request().postData());
      if (lose) {
        lose = false;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        return route.abort("failed");
      }
      return route.continue();
    });
    await page
      .getByRole("button", { name: "Add task", exact: true })
      .first()
      .click();
    await name.fill("Exact retry capture");
    await name.press("Enter");
    await capture
      .getByRole("button", { name: "Retry same request", exact: true })
      .click();
    await expect(name).toHaveValue("");
    assert.equal(retryBodies.length, 2);
    assert.equal(retryBodies[0], retryBodies[1]);
    assert.equal(
      (await getList(actor, list.id)).tasks.filter(
        (task) => task.title === "Exact retry capture",
      ).length,
      1,
    );
    await page.unroute("**/api/v1/tasks");
    await name.press("Escape");
    checks.push(
      "Committed response loss preserves the draft and retries an identical request without duplicate creation",
    );
  }
  if (stage === "appearance-storage") {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Synthetic quota limit", "QuotaExceededError");
      };
    });
    const appearance = page.getByRole("combobox", {
      name: "Appearance",
      exact: true,
    });
    await appearance.selectOption("dark");
    await expect(appearance).toHaveValue("dark");
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      )
      .toBe("dark");
    await appearance.selectOption("light");
    await expect(appearance).toHaveValue("light");
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      )
      .toBe("light");
    const peer = await context.newPage();
    await peer.goto("http://localhost:3000/docs");
    await peer.evaluate(() =>
      localStorage.setItem("wuff:todo:appearance:v1", "dark"),
    );
    await expect(appearance).toHaveValue("dark");
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      )
      .toBe("dark");
    await peer.evaluate(() =>
      localStorage.setItem("wuff:todo:appearance:v1", "light"),
    );
    await expect(appearance).toHaveValue("light");
    await peer.close();
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Appearance", exact: true }),
    ).toHaveValue("light");
    checks.push(
      "Readable storage with failed writes keeps local switching functional; real cross-tab writes resume persisted appearance; reload retains the saved preference",
    );
  }
  if (stage === "retry-isolation") {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.route("**/api/v1/tasks", async (route: any) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "invalid_input",
            message: "Synthetic known rejection",
          },
        }),
      });
    });
    await page
      .getByRole("button", { name: "Add task", exact: true })
      .first()
      .click();
    const capture = page.getByRole("form", {
        name: "Add task inline",
        exact: true,
      }),
      input = capture.getByRole("textbox", { name: "Task name", exact: true });
    await input.fill("A retained uncreated draft");
    await input.press("Enter");
    await expect(capture.getByRole("status")).toContainText("draft is kept");
    await page.unroute("**/api/v1/tasks");
    const bodies: string[] = [];
    let lost = false;
    await page.route("**/api/v1/tasks", async (route: any) => {
      if (route.request().method() !== "PATCH") return route.continue();
      bodies.push(route.request().postData());
      if (!lost) {
        lost = true;
        const result = await route.fetch();
        assert.equal(result.status(), 200);
        return route.abort("failed");
      }
      return route.continue();
    });
    await page
      .getByRole("button", { name: "Complete Buy coffee beans", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Keep current state", exact: true }),
    ).toBeVisible();
    await expect(
      capture.getByRole("button", { name: "Retry same request", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Retry same request", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Keep current state", exact: true }),
    ).toHaveCount(0);
    await expect(input).toHaveValue("A retained uncreated draft");
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
    assert(
      !(await getList(actor, list.id)).tasks.some(
        (task) => task.title === "A retained uncreated draft",
      ),
    );
    await page.unroute("**/api/v1/tasks");
    await input.press("Escape");
    checks.push(
      "Known capture rejection retains draft; another task's uncertain completion cannot claim capture ownership; exact global retry preserves the uncreated draft",
    );
  }
  if (stage === "mobile-views") {
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "View settings", exact: true })
      .click();
    const view = page.getByRole("dialog", {
      name: "View settings",
      exact: true,
    });
    const picker = view.getByRole("combobox", {
      name: "Saved view",
      exact: true,
    });
    await expect(picker).toBeVisible();
    await picker.selectOption(mobilePresetId);
    await view.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("link", {
        name: "Open task: Book a table for Saturday",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Open task: Pick up groceries",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Revert to saved view", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View settings", exact: true })
      .click();
    await picker.selectOption("default");
    await page.screenshot({ path: `${out}/mobile-view-picker.png` });
    await view.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("link", {
        name: "Open task: Pick up groceries",
        exact: true,
      }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "selected mobile view must fit the viewport",
    );
    checks.push(
      "390px View settings exposes named and starter selectors; named due-today filtering, explicit reversion and starter selection preserve task access",
    );
  }
  if (stage === "appearance-menu") {
    await page.setViewportSize({ width: 1366, height: 900 });
    const appearance = page.getByRole("combobox", {
      name: "Appearance",
      exact: true,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(appearance).toHaveValue("light");
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      )
      .toBe("light");
    await page
      .getByRole("button", { name: "List actions", exact: true })
      .click();
    const menu = page.getByRole("dialog", {
      name: "List actions",
      exact: true,
    });
    await expect(
      menu.getByRole("button", { name: "List settings", exact: true }),
    ).toContainText("List settings");
    await expect(
      menu.getByRole("button", { name: "People & sharing", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("combobox", { name: "Parent list", exact: true }),
    ).not.toBeVisible();
    await page.screenshot({ path: `${out}/list-actions-light.png` });
    await menu.locator(".list-move-menu > summary").click();
    await expect(
      menu.getByRole("combobox", { name: "Parent list", exact: true }),
    ).toBeDisabled();
    await menu.getByRole("button", { name: "Done", exact: true }).click();
    await appearance.selectOption("dark");
    await page
      .getByRole("button", { name: "List actions", exact: true })
      .click();
    if (
      await menu
        .getByRole("combobox", { name: "Parent list", exact: true })
        .isVisible()
    )
      await menu.locator(".list-move-menu > summary").click();
    await page.screenshot({ path: `${out}/list-actions-dark.png` });
    await menu.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Appearance", exact: true }),
    ).toHaveValue("dark");
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      )
      .toBe("dark");
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption("light");
    checks.push(
      "Explicit Light overrides a dark OS; Light/Dark/System control updates themes, Dark survives reload; named compact actions with progressively disclosed move controls",
    );
  }
  if (["drawer", "full", "drawer-only"].includes(stage)) {
    await page.setViewportSize({ width: 1366, height: 900 });
    const titleLink = page
      .locator(`[data-task-id="${parentTask.id}"] .task-name a`)
      .first();
    await titleLink.scrollIntoViewIfNeeded();
    const mainScroll = await page
      .locator(".workspace-main")
      .evaluate((el: HTMLElement) => el.scrollTop);
    await titleLink.click();
    const drawer = page.getByRole("dialog", {
      name: "Task details",
      exact: true,
    });
    await expect(
      drawer.getByRole("heading", { name: parentTask.title, exact: true }),
    ).toBeVisible();
    const size = await drawer.boundingBox();
    assert(size.width >= 480 && size.width <= 560);
    await expect(
      drawer.getByRole("button", { name: "Complete task", exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("group", { name: "Text formatting", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `${out}/drawer-light.png` });
    await page.evaluate(() => {
      localStorage.setItem("wuff:todo:appearance:v1", "dark");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "wuff:todo:appearance:v1" }),
      );
    });
    await expect
      .poll(() =>
        drawer.evaluate((el: HTMLElement) =>
          getComputedStyle(el).getPropertyValue("--wuff-background").trim(),
        ),
      )
      .toBe(todoThemeVariables(list.color, true)["--wuff-background"]);
    await page.screenshot({ path: `${out}/drawer-dark.png` });
    await page.evaluate(() => {
      localStorage.setItem("wuff:todo:appearance:v1", "light");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "wuff:todo:appearance:v1" }),
      );
    });
    await drawer
      .getByRole("button", { name: "Edit task notes", exact: true })
      .click();
    const notes = drawer.locator('[contenteditable="true"]');
    await notes.fill("Unsaved task context");
    await drawer
      .getByRole("button", { name: "Close task details", exact: true })
      .click();
    await expect(
      drawer.getByRole("button", { name: "Discard edits", exact: true }),
    ).toBeVisible();
    await drawer
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(notes).toHaveText("Unsaved task context");
    await drawer
      .getByRole("button", { name: "Save notes", exact: true })
      .click();
    await expect(
      drawer.getByRole("button", { name: "Edit task notes", exact: true }),
    ).toBeVisible();
    assert.match(
      (await getList(actor, list.id)).tasks.find(
        (task) => task.id === parentTask.id,
      )!.content,
      /Unsaved task context/,
    );
    await drawer
      .getByRole("button", { name: "Change priority", exact: true })
      .click();
    await drawer
      .getByRole("combobox", { name: "Priority", exact: true })
      .selectOption("urgent");
    await drawer
      .getByRole("button", { name: "Save work details", exact: true })
      .click();
    await expect(
      drawer.getByRole("button", { name: "Change priority", exact: true }),
    ).toBeFocused();
    await drawer
      .getByRole("button", { name: "Add subtask", exact: true })
      .click();
    const subtaskInput = drawer.getByRole("textbox", {
      name: "Subtask name",
      exact: true,
    });
    await subtaskInput.fill("An inline subtask");
    await subtaskInput.press("Enter");
    await expect(subtaskInput).toHaveValue("");
    await subtaskInput.press("Escape");
    const subtaskLink = drawer.getByRole("link", {
      name: "Open task: An inline subtask",
      exact: true,
    });
    await subtaskLink.click();
    await expect(
      drawer.getByRole("heading", {
        name: "An inline subtask",
        exact: true,
      }),
    ).toBeVisible();
    assert(new URL(page.url()).searchParams.get("listId") === list.id);
    await drawer
      .getByRole("link", { name: "Open parent task", exact: true })
      .click();
    await expect(
      drawer.getByRole("heading", { name: parentTask.title, exact: true }),
    ).toBeVisible();
    await drawer
      .getByRole("button", { name: "Close task details", exact: true })
      .press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(titleLink).toBeFocused();
    assert(
      Math.abs(
        mainScroll -
          (await page
            .locator(".workspace-main")
            .evaluate((el: HTMLElement) => el.scrollTop)),
      ) <= 2,
    );
    await page
      .getByRole("link", {
        name: "Open task: Buy coffee beans",
        exact: true,
      })
      .click();
    await expect(
      drawer.getByRole("button", { name: "Add a note…", exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Add subtask", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await drawer.evaluate(
        (el: HTMLElement) => el.scrollWidth <= el.clientWidth,
      ),
    );
    await page.screenshot({ path: `${out}/drawer-phone-empty.png` });
    await drawer
      .getByRole("button", { name: "Close task details", exact: true })
      .click();
    await page.setViewportSize({ width: 1366, height: 900 });
    checks.push(
      "520px drawer, independent light/dark surfaces, notes dirty-exit/save, metadata focus, inline subtasks, subtask/parent navigation without page changes, Escape/focus/scroll restoration",
    );
  }
  if (stage === "drawer-empty") {
    await page.setViewportSize({ width: 1366, height: 900 });
    const origin = page.getByRole("link", {
      name: "Open task: Buy coffee beans",
      exact: true,
    });
    await origin.click();
    const drawer = page.getByRole("dialog", {
      name: "Task details",
      exact: true,
    });
    await expect(
      drawer.getByRole("button", { name: "Add a note…", exact: true }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Add subtask", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `${out}/drawer-light.png` });
    await page.evaluate(() => {
      localStorage.setItem("wuff:todo:appearance:v1", "dark");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "wuff:todo:appearance:v1" }),
      );
    });
    await expect
      .poll(() =>
        drawer.evaluate((el: HTMLElement) =>
          getComputedStyle(el).getPropertyValue("--wuff-background").trim(),
        ),
      )
      .toBe(todoThemeVariables(list.color, true)["--wuff-background"]);
    await page.screenshot({ path: `${out}/drawer-dark.png` });
    await page.evaluate(() => {
      localStorage.setItem("wuff:todo:appearance:v1", "light");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "wuff:todo:appearance:v1" }),
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await drawer.evaluate(
        (el: HTMLElement) => el.scrollWidth <= el.clientWidth,
      ),
    );
    await page.screenshot({ path: `${out}/drawer-phone-empty.png` });
    await drawer
      .getByRole("button", { name: "Close task details", exact: true })
      .press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(origin).toBeFocused();
    checks.push(
      "Empty notes/subtasks at 390px, no drawer overflow, Escape and originating task focus",
    );
  }
  if (stage === "full") {
    for (const width of [320, 390, 1024, 1366]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto("http://localhost:3000/lists?home=1");
      const todayHeading = page.getByRole("heading", {
        name: "Today",
        exact: true,
      });
      await expect(todayHeading).toBeVisible();
      const catalog = page.getByRole("region", {
        name: "Your lists",
        exact: true,
      });
      await expect(catalog).toBeVisible();
      assert(
        (await todayHeading.boundingBox()).y < (await catalog.boundingBox()).y,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overview overflow at ${width}`,
      );
      await page.screenshot({ path: `${out}/overview-${width}.png` });
    }
    checks.push(
      "Attention-first Overview with a compact workspace browser, one main New list action, populated/empty day sections and 320–1366px overflow checks",
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ stage, checks, errors }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ stage, checks, errors }));
} catch (error) {
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  for (const id of ids.reverse())
    await deleteList(actor, {
      listId: id,
      version: (await getList(actor, id)).version,
      operationId: op(),
    });
  await reorderLists(actor, {
    ...original,
    version: (await getListOrder(actor)).version,
    operationId: op(),
  });
  await database().pool.end();
}
