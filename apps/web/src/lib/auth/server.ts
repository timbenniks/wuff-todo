import { createNeonAuth } from "@neondatabase/auth/next/server";
import { database, users } from "@wuff/db";
import { eq } from "drizzle-orm";
import { Actor, AppError, scopes } from "@wuff/contracts";
import { cache } from "react";
import { headers } from "next/headers";
import { sessionIdentity } from "./session-result";
import { pageSession } from "./page-session";

let instance: ReturnType<typeof createNeonAuth> | undefined;
export function neonAuth() {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET)
    throw new Error("Neon Auth configuration is missing");
  return (instance ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET, sessionDataTtl: 1 },
    logLevel: "silent",
  }));
}
export const webIdentity = cache(async () => {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET)
    throw new Error("Neon Auth configuration is missing");
  return sessionIdentity(
    await pageSession(
      {
        baseUrl: process.env.NEON_AUTH_BASE_URL,
        cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
      },
      await headers(),
    ),
  );
});
const routeIdentity = cache(async () => {
  const result = await neonAuth().getSession({
    query: { disableCookieCache: "true" },
  });
  return sessionIdentity(result);
});
export async function webActor(): Promise<Actor> {
  return actorForIdentity(await routeIdentity());
}
export const pageActor = cache(async (): Promise<Actor> => {
  return actorForIdentity(await webIdentity());
});
async function actorForIdentity(
  identity: { id: string } | null,
): Promise<Actor> {
  if (!identity) throw new AppError("unauthorized", "Please sign in.", 401);
  const [user] = await database()
    .db.select()
    .from(users)
    .where(eq(users.id, identity.id));
  if (!user?.enabled)
    throw new AppError(
      "invite_required",
      "Your account needs a Wuff invitation.",
      403,
    );
  const expectedUser = (await headers()).get("X-Wuff-User");
  if (expectedUser && expectedUser !== user.id)
    throw new AppError(
      "account_changed",
      "Your signed-in account changed. Reload Wuff to continue.",
      409,
    );
  return { id: user.id, scopes };
}
