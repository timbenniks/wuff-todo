import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function loginFixture(user: { email: string; password: string }) {
  const origin = "http://localhost:3000";
  if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
    throw new Error("Synthetic logins require isolated development");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(origin + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (response.status === 429 && attempt < 3) {
      const seconds = Number(response.headers.get("Retry-After"));
      await delay(
        Math.max(
          5,
          Math.min(30, Number.isFinite(seconds) && seconds > 0 ? seconds : 15),
        ) * 1000,
      );
      continue;
    }
    assert.equal(
      response.status,
      200,
      "Synthetic user can sign in through Neon proxy",
    );
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }
  throw new Error("Synthetic sign-in retries exhausted");
}
