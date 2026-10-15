import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { database, users } from "@wuff/db";

config({ path: ".env.local", quiet: true });
if (
  process.env.WUFF_ORIGIN !== "http://localhost:3000" ||
  !process.env.NEON_AUTH_BASE_URL?.includes("ep-snowy-hill-b9wcml7l")
)
  throw new Error("Seed only the configured isolated development branch.");
const file = ".vercel/dev-users.json";
try {
  await readFile(file);
  console.log("Development fixture already exists; no users created.");
} catch {
  const fixtures = [];
  for (const name of ["Alex", "Sam", "Outsider"]) {
    const password = randomBytes(30).toString("base64url"),
      email = `wuff-${name.toLowerCase()}-${randomBytes(6).toString("hex")}@example.invalid`;
    const response = await fetch(
      `${process.env.NEON_AUTH_BASE_URL}/sign-up/email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name, email, password }),
      },
    );
    if (!response.ok)
      throw new Error(
        `Synthetic auth provisioning failed (${response.status}); temporarily enable sign-up only on development to seed.`,
      );
    const data = await response.json();
    if (!data.user?.id) throw new Error("Neon did not return a user identity");
    if (name !== "Outsider")
      await database()
        .db.insert(users)
        .values({ id: data.user.id, name, email });
    fixtures.push({ id: data.user.id, name, email, password });
  }
  await mkdir(".vercel", { recursive: true });
  await writeFile(file, JSON.stringify(fixtures), { mode: 0o600 });
  console.log(
    "Three synthetic identities created; two admitted to Wuff. Credentials saved only in ignored local fixture.",
  );
}
await database().pool.end();
