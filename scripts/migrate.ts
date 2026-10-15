import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url || new URL(url).hostname.includes("-pooler"))
  throw new Error("A direct DATABASE_URL_UNPOOLED is required for migrations");
const connection = new URL(url);
connection.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: connection.href });
try {
  await migrate(drizzle(pool), { migrationsFolder: "packages/db/migrations" });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
