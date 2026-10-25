import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { empireAppPreference, type EmpireSettings } from "@wuff/contracts";
import { loginFixture } from "./helpers/login";

const origin = "http://localhost:3000";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.WUFF_ORIGIN !== origin
)
  throw Error("Isolated development only");
const escaped = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
test("private first HTML includes current app choices and names; hidden choices and parallel accounts remain isolated", async () => {
  const [user, other] = JSON.parse(
    await readFile(".vercel/dev-users.json", "utf8"),
  );
  const cookie = await loginFixture(user),
    otherCookie = await loginFixture(other);
  const headers = {
    Cookie: cookie,
    "X-Wuff-User": user.id,
    Origin: origin,
    "Content-Type": "application/json",
  };
  async function getSettings(): Promise<EmpireSettings> {
    const r = await fetch(origin + "/api/v1/empire", { headers });
    assert.equal(r.status, 200);
    return r.json();
  }
  async function setVisibility(visible: boolean) {
    const current = await getSettings();
    const r = await fetch(origin + "/api/v1/empire", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        version: current.version,
        operationId: crypto.randomUUID(),
        changes: [{ appId: "totake", visible }],
      }),
    });
    assert.equal(r.status, 200);
  }
  const original = await getSettings();
  const name = (
    await (
      await fetch(origin + "/api/v1/dashboard?today=2026-10-25&limit=1", {
        headers,
      })
    ).json()
  ).name;
  const otherName = (
    await (
      await fetch(origin + "/api/v1/dashboard?today=2026-10-25&limit=1", {
        headers: { Cookie: otherCookie, "X-Wuff-User": other.id },
      })
    ).json()
  ).name;
  assert.notEqual(name, otherName);
  try {
    await setVisibility(false);
    const responses = await Promise.all(
      ["/", "/lists?home=1", "/totake", "/settings/apps"].map((path) =>
        fetch(origin + path, { headers }),
      ),
    );
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.match(
        response.headers.get("cache-control") ?? "",
        /private|no-store/,
      );
      const html = await response.text();
      const header = html.match(
        /<header class="empire-header"[\s\S]*?<\/header>/,
      )?.[0];
      assert.ok(
        header,
        "Shell is real server-rendered HTML, not a client-only placeholder",
      );
      assert.ok(
        !header.includes('href="/totake"'),
        "Hidden app is absent before client fetches",
      );
      if (response.url === origin + "/")
        assert.match(
          html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "",
          new RegExp(escaped(name)),
        );
      if (response.url.includes("/lists"))
        assert.ok(
          html
            .match(/<header class="home-daily-header"[\s\S]*?<\/header>/)?.[0]
            .includes(escaped(name)),
        );
    }
    const [one, two] = await Promise.all([
      fetch(origin + "/", { headers }).then((r) => r.text()),
      fetch(origin + "/", {
        headers: { Cookie: otherCookie, "X-Wuff-User": other.id },
      }).then((r) => r.text()),
    ]);
    assert.ok(
      one.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0].includes(escaped(name)),
    );
    assert.ok(
      two.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0].includes(escaped(otherName)),
    );
    await setVisibility(true);
    const visible = await (await fetch(origin + "/", { headers })).text();
    assert.ok(
      visible
        .match(/<header class="empire-header"[\s\S]*?<\/header>/)?.[0]
        .includes('href="/totake"'),
    );
    const denied = await fetch(origin + "/", { redirect: "manual" });
    assert.ok(denied.status >= 300 && denied.status < 400);
    assert.match(denied.headers.get("location") ?? "", /^\/sign-in/);
    const docs = await fetch(origin + "/docs");
    assert.equal(docs.status, 200);
    assert.ok(!(await docs.text()).includes('class="empire-header"'));
  } finally {
    await setVisibility(empireAppPreference(original.apps, "totake").visible);
    await Promise.all(
      [cookie, otherCookie].map((Cookie) =>
        fetch(origin + "/api/auth/sign-out", {
          method: "POST",
          headers: {
            Cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
      ),
    );
  }
});
