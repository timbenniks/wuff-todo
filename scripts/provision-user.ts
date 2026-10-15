import { config } from "dotenv";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { database } from "@wuff/db";

// Operator-only bootstrap. No public registration or auth-table writes.
const { values } = parseArgs({
  options: {
    target: { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
  },
});
const targets = {
  development: {
    env: ".env.local",
    branch: "br-plain-field-b9ubcjv4",
    endpoint: "ep-snowy-hill-b9wcml7l",
  },
  production: {
    env: ".env.production.local",
    branch: "br-twilight-glitter-b9dbgk2g",
    endpoint: "ep-cold-fire-b9i4z5zn",
  },
};
const target = targets[values.target as keyof typeof targets];
if (!target || !values.email || !values.name)
  throw new Error(
    "Provide --target development|production --email and --name.",
  );
const email = values.email.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error("Provide a valid email address.");
config({ path: target.env, quiet: true });
for (const key of ["DATABASE_URL", "NEON_AUTH_BASE_URL"]) {
  const host = new URL(process.env[key] ?? "").hostname;
  if (
    !host.startsWith(`${target.endpoint}.`) &&
    !host.startsWith(`${target.endpoint}-pooler.`)
  )
    throw new Error("Environment does not match the selected target.");
}
const { pool } = database();
try {
  const identity = async () =>
    (
      await pool.query<{ id: string; email: string; name: string }>(
        'select id,email,name from neon_auth."user" where lower(email)=$1',
        [email],
      )
    ).rows[0];
  let user = await identity();
  if (!user) {
    let failed = false;
    try {
      execFileSync(
        "pnpm",
        [
          "dlx",
          "neon@latest",
          "neon-auth",
          "user",
          "create",
          "--project-id",
          "noisy-leaf-56955387",
          "--branch",
          target.branch,
          "--email",
          email,
          "--name",
          values.name,
        ],
        { stdio: "pipe" },
      );
    } catch {
      failed = true;
    }
    // Reconcile even an unknown CLI outcome; never blindly retry creation.
    user = await identity();
    if (!user)
      throw new Error(
        failed
          ? "Neon provisioning failed; no admission added."
          : "Neon identity was not found after provisioning.",
      );
  }
  await pool.query(
    `insert into wuff_users(id,email,name) values($1,$2,$3) on conflict(id) do nothing`,
    [user.id, email, user.name],
  );
  const admitted = (
    await pool.query<{ enabled: boolean; email: string }>(
      "select enabled,email from wuff_users where id=$1",
      [user.id],
    )
  ).rows[0];
  if (!admitted?.enabled || admitted.email !== email)
    throw new Error(
      "Existing admission is disabled or mismatched; left unchanged.",
    );
  console.log(
    "Identity and enabled Wuff admission confirmed. No password or activation code displayed.",
  );
} finally {
  await pool.end();
}
