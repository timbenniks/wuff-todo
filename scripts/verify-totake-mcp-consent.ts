// Loopback synthetic OAuth/browser proof. No production or medication writes.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { loginFixture } from "../tests/helpers/login";
import { empireMcp } from "../tests/helpers/empire-grant";

if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN
)
  throw Error("Isolated development with publishing disabled only");
const origin = "http://localhost:3000";
const resource = origin + "/api/mcp";
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const cookie = await loginFixture(user);
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const tokens: {
  clientId: string;
  access_token: string;
  refresh_token: string;
}[] = [];
const errors: string[] = [];
const headers = {
  Origin: origin,
  Cookie: cookie,
  "Content-Type": "application/json",
  "X-Wuff-User": user.id,
};
async function request(scope?: string, existing?: string) {
  const verifier = randomBytes(32).toString("base64url");
  const redirectUri = "http://127.0.0.1:4173/callback";
  const registered = existing
    ? { client_id: existing }
    : await (
        await fetch(origin + "/oauth/register", {
          method: "POST",
          headers,
          body: JSON.stringify({
            client_name: "Totake consent regression fixture",
            redirect_uris: [redirectUri],
          }),
        })
      ).json();
  const query = new URLSearchParams({
    client_id: registered.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    state: randomBytes(16).toString("hex"),
    resource,
    ...(scope === undefined ? {} : { scope }),
  });
  return {
    clientId: registered.client_id as string,
    query,
    verifier,
    redirectUri,
  };
}
type Request = Awaited<ReturnType<typeof request>>;
async function exchange(req: Request, redirect: string) {
  const code = new URL(redirect).searchParams.get("code");
  assert(code);
  const response = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: req.clientId,
      redirect_uri: req.redirectUri,
      code,
      code_verifier: req.verifier,
      resource,
    }),
  });
  assert.equal(response.status, 200);
  const token = { ...(await response.json()), clientId: req.clientId };
  tokens.push(token);
  return token as {
    clientId: string;
    access_token: string;
    refresh_token: string;
    scope: string;
  };
}
async function approve(req: Request, optionalScopes: string[]) {
  return fetch(origin + "/oauth/authorize/decision", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: req.query.toString(),
      accept: true,
      optionalScopes,
    }),
  });
}
try {
  const context = await browser.newContext();
  const browserLogin = await context.request.post(
    origin + "/api/auth/sign-in/email",
    {
      headers: { Origin: origin },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(browserLogin.status(), 200);
  const page = await context.newPage();
  page.on("pageerror", (error: Error) => errors.push(error.message));
  const req = await request();
  const baseline = await approve(req, []);
  assert.equal(baseline.status, 200);
  const old = await exchange(req, (await baseline.json()).redirect);
  assert(!old.scope.includes("totake:read"));
  assert((await empireMcp(old.access_token, "get_totake")).result.isError);

  await mkdir("artifacts/totake-mcp-consent", { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(origin + "/settings/connections?clientId=" + req.clientId);
    const choices = page.getByRole("region", { name: "MCP tool choices" });
    await expect(
      choices.getByText(
        "4 selected · client access unverified · 4 need consent",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await expect(
      choices.getByText(
        /selected tools need additional permission and cannot run/,
      ),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/totake-mcp-consent/settings-${width}.png`,
      fullPage: true,
    });
  }
  // Saving checked tools must not silently grant access.
  await page
    .getByRole("button", { name: "Save tool choices", exact: true })
    .click();
  await expect(
    page.getByText(/Selected tools awaiting consent remain unavailable/),
  ).toBeVisible();
  assert((await empireMcp(old.access_token, "get_totake")).result.isError);

  const recovery = await request(undefined, req.clientId);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(origin + "/oauth/authorize?" + recovery.query);
    await expect(
      page.getByRole("checkbox", { name: /^Read Totake/ }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /^Change Totake/ }),
    ).toBeDisabled();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/totake-mcp-consent/consent-${width}.png`,
      fullPage: true,
    });
  }
  const read = page.getByRole("checkbox", { name: /^Read Totake/ });
  const write = page.getByRole("checkbox", { name: /^Change Totake/ });
  await read.focus();
  await page.keyboard.press("Space");
  await expect(read).toBeChecked();
  await expect(write).toBeEnabled();
  await write.check();
  await read.uncheck();
  await expect(write).not.toBeChecked();
  await expect(write).toBeDisabled();
  await read.check();
  await write.check();
  let callback = "";
  await page.route("http://127.0.0.1:4173/callback**", async (route: any) => {
    callback = route.request().url();
    await route.fulfill({
      contentType: "text/plain",
      body: "Synthetic callback received",
    });
  });
  await page
    .getByRole("button", { name: "Allow connection", exact: true })
    .click();
  await expect.poll(() => !!callback).toBe(true);
  const approved = await exchange(recovery, callback);
  assert(
    approved.scope.includes("totake:read") &&
      approved.scope.includes("totake:write"),
  );
  assert.equal(
    (await empireMcp(approved.access_token, "get_totake")).result.isError,
    undefined,
  );
  // Approval creates a new grant; the old token retains its original ceiling.
  assert((await empireMcp(old.access_token, "get_totake")).result.isError);
  await page.goto(origin + "/settings/connections?clientId=" + req.clientId);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(
      page.getByText("4 selected · client access unverified", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/An older token can still be denied/),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/totake-mcp-consent/mixed-grants-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Save tool choices", exact: true })
    .click();
  await expect(
    page.getByText(/Client access is still unverified/),
  ).toBeVisible();
  assert((await empireMcp(old.access_token, "get_totake")).result.isError);
  // Refreshing the old grant cannot adopt the newer grant's Totake consent.
  const refreshed = await fetch(origin + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: req.clientId,
      refresh_token: old.refresh_token,
      resource,
    }),
  });
  assert.equal(refreshed.status, 200);
  const rotated = { ...(await refreshed.json()), clientId: req.clientId };
  tokens.push(rotated);
  assert(!rotated.scope.split(" ").includes("totake:read"));
  assert((await empireMcp(rotated.access_token, "get_totake")).result.isError);

  const explicit = await request("lists:read", req.clientId);
  await page.goto(origin + "/oauth/authorize?" + explicit.query);
  await expect(
    page.getByRole("checkbox", { name: /^Read Totake/ }),
  ).toHaveCount(0);
  assert.equal((await approve(explicit, ["totake:read"])).status, 400);
  for (const optional of [["totake:write"], ["totake:read", "agents:manage"]]) {
    assert.equal(
      (await approve(await request(undefined, req.clientId), optional)).status,
      400,
    );
  }
  const cancel = await fetch(origin + "/oauth/authorize/decision", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: (await request(undefined, req.clientId)).query.toString(),
      accept: false,
      optionalScopes: ["totake:read"],
    }),
  });
  assert.equal(
    new URL((await cancel.json()).redirect).searchParams.get("error"),
    "access_denied",
  );
  const foreign = await fetch(origin + "/oauth/authorize/decision", {
    method: "POST",
    headers: { ...headers, Origin: "https://foreign.invalid" },
    body: JSON.stringify({
      query: recovery.query.toString(),
      accept: true,
      optionalScopes: ["totake:read"],
    }),
  });
  assert.equal(foreign.status, 403);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: checked-but-denied settings, explicit browser consent, real token/MCP recovery, old-token ceiling, invalid/foreign/cancel paths, keyboard and 320/390/1280px layouts.",
  );
} finally {
  // Revoke only grants created by this run; no real accounts/connections touched.
  for (const token of tokens) {
    const response = await fetch(origin + "/oauth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: token.refresh_token,
        client_id: token.clientId,
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await empireMcp(token.access_token, "get_totake")).status,
      401,
    );
  }
  await browser.close();
}
