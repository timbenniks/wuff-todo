import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { database } from "@wuff/db";

if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw new Error("Activation tests require the isolated development branch.");
const { pool } = database();
const origin = "http://localhost:3000";
const requestPath = "/api/auth/email-otp/request-password-reset";
const resetPath = "/api/auth/email-otp/reset-password";
const fixture = "activation-fixture@example.invalid";
const headers = { Origin: origin, "Content-Type": "application/json" };
const post = (path: string, body: unknown, originOverride = origin) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { ...headers, Origin: originOverride },
    body: JSON.stringify(body),
  });
after(async () => {
  await pool.end();
});

test("activation/recovery stays admission-gated and validates origin, method, and code", async () => {
  const {
    rows: [user],
  } = await pool.query<{ id: string; enabled: boolean }>(
    "select id,enabled from wuff_users where email=$1",
    [fixture],
  );
  assert.ok(user?.enabled, "Provision the synthetic activation fixture first.");
  assert.equal((await fetch(`${origin}${requestPath}`)).status, 405);
  assert.equal(
    (await post(requestPath, { email: fixture }, "https://untrusted.invalid"))
      .status,
    403,
  );
  assert.equal((await post(requestPath, { email: "bad" })).status, 400);
  // Never forward caller-supplied identities, redirects, or extra managed options.
  assert.equal(
    (
      await post(requestPath, {
        email: fixture,
        redirectTo: "https://untrusted.invalid",
      })
    ).status,
    400,
  );
  const unknown = `uninvited-${randomBytes(8).toString("hex")}@example.invalid`;
  assert.deepEqual(await (await post(requestPath, { email: unknown })).json(), {
    success: true,
  });
  assert.equal(
    (
      await post(resetPath, {
        email: unknown,
        otp: "000000",
        password: randomBytes(20).toString("hex"),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await pool.query('select id from neon_auth."user" where email=$1', [
        unknown,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "select id from neon_auth.verification where identifier like $1",
        [`%${unknown}%`],
      )
    ).rowCount,
    0,
  );
  await pool.query("update wuff_users set enabled=false where id=$1", [
    user.id,
  ]);
  try {
    assert.deepEqual(
      await (await post(requestPath, { email: fixture })).json(),
      { success: true },
    );
    assert.equal(
      (
        await post(resetPath, {
          email: fixture,
          otp: "000000",
          password: randomBytes(20).toString("hex"),
        })
      ).status,
      400,
    );
  } finally {
    await pool.query("update wuff_users set enabled=true where id=$1", [
      user.id,
    ]);
  }
  const before = (
    await pool.query<{ password: string }>(
      `select password from neon_auth.account where "userId"=$1 and "providerId"='credential'`,
      [user.id],
    )
  ).rows[0].password;
  const send = await post(requestPath, { email: ` ${fixture.toUpperCase()} ` });
  assert.equal(
    send.status,
    200,
    "Neon accepts the synthetic email-code request",
  );
  const { rows: codes } = await pool.query(
    'select id from neon_auth.verification where identifier=$1 and "expiresAt">now()',
    [`forget-password-otp-${fixture}`],
  );
  assert.ok(
    codes.length > 0,
    "Managed service persisted an expiring challenge",
  );
  assert.equal(
    (
      await post(resetPath, {
        email: fixture,
        otp: "not-a-code",
        password: "too-short",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(resetPath, {
        email: fixture,
        otp: "123456",
        password: randomBytes(20).toString("hex"),
      })
    ).status,
    400,
  );
  const after = (
    await pool.query<{ password: string }>(
      `select password from neon_auth.account where "userId"=$1 and "providerId"='credential'`,
      [user.id],
    )
  ).rows[0].password;
  assert.ok(before === after, "Rejected codes cannot change credentials");
  assert.equal(
    (
      await post("/api/auth/sign-up/email", {
        email: unknown,
        password: randomBytes(20).toString("hex"),
        name: "Uninvited",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/api/auth/sign-in/email-otp", {
        email: unknown,
        otp: "123456",
      })
    ).status,
    403,
  );
});
