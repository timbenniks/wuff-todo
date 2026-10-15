import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

let instance: ReturnType<typeof connect> | undefined;
function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const connection = new URL(process.env.DATABASE_URL);
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({
    connectionString: connection.href,
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return { db: drizzle(pool, { schema }), pool };
}
export const database = () => (instance ??= connect());
export * from "./schema";
